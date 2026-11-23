import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { convertFile, type LoadedFile } from "@/lib/files";
import { analyzeTender } from "@/lib/ai/analyze";
import type { AiChange } from "@/lib/ai/schema";
import { BUCKET } from "@/lib/tenders";
import { DEADLINE_TYPE_LABELS, ISSUE_CATEGORY_LABELS, formatDue, isoToIsraelParts } from "@/lib/analysis";
import type { DeadlineType, IssueCategory, ItemType, MissingItem, SourceRef, TenderDocument } from "@/lib/types";

// The analysis runs in after(), which gets the route's max duration (ADR-16)
export const maxDuration = 300;

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: runId, error } = await supabase.rpc("start_analysis", { p_tender: id });
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  if (!runId) return NextResponse.json({ error: "already running" }, { status: 409 });

  after(() => runAnalysis(id, runId as string));
  return NextResponse.json({ runId }, { status: 202 });
}

type Admin = ReturnType<typeof createAdminClient>;

// Tasks that get a details line: how and where to submit (ADR-33)
const DETAIL_TYPES = new Set<string>(["submission", "clarification_questions"]);

async function runAnalysis(tenderId: string, runId: string) {
  const db = createAdminClient();
  try {
    const { data: run, error: runError } = await db
      .from("analysis_runs")
      .select("is_reanalysis")
      .eq("id", runId)
      .single();
    if (runError) throw new Error(`run: ${runError.message}`);
    const existing = run.is_reanalysis ? await loadExisting(db, tenderId) : null;

    const { data: docs, error } = await db
      .from("tender_documents")
      .select("*")
      .eq("tender_id", tenderId)
      .order("created_at");
    if (error) throw new Error(`documents: ${error.message}`);

    const loaded = await Promise.all((docs as TenderDocument[]).map((doc) => loadDocument(db, doc)));
    const readable = loaded.flatMap((f) => (f.ok ? [f] : []));
    if (readable.length === 0) throw new Error("no readable files");

    const out = await analyzeTender(readable, existing?.text);
    const r = out.result;
    const quality = new Map(r.documents.map((d) => [d.file_name, d]));
    // Updates of existing items (ADR-33): any item, also a manual one, since approval decides
    const changes = existing ? buildChanges(existing.items, r.changes) : [];
    const changedIds = new Set(changes.map((c) => c.target_id));
    // Only items that came from the documents can be "not found again"
    const missing = existing
      ? [...new Set(r.missing_ids)].flatMap((short) => {
          const item = existing.items.get(short.trim().toUpperCase());
          return item && !item.manual && !changedIds.has(item.item_id)
            ? [{ item_type: item.item_type, item_id: item.item_id, label: item.label }]
            : [];
        })
      : [];

    await db
      .rpc(existing ? "save_reanalysis" : "save_analysis", {
        p_run: runId,
        p_result: {
          missing,
          changes,
          model: out.model,
          input_tokens: out.inputTokens,
          output_tokens: out.outputTokens,
          requirements: r.requirements,
          deadlines: r.deadlines,
          // The details line belongs only to the submission and clarification-questions tasks
          tasks: r.tasks.map((t) => {
            const type = r.deadlines.find((d) => d.key === t.deadline_key)?.type;
            // On a re-analysis, a short id (R1) points at an existing requirement
            const target = existing?.items.get(t.requirement_key?.trim().toUpperCase() ?? "");
            return {
              ...t,
              details: type && DETAIL_TYPES.has(type) ? t.details : null,
              requirement_id: target?.item_type === "requirement" ? target.item_id : null,
            };
          }),
          issues: r.issues,
          documents: (docs as TenderDocument[]).map((doc, i) => {
            const file = loaded[i];
            if (!file.ok) return { id: doc.id, read_warning: "unreadable", read_note: file.note };
            const q = quality.get(doc.file_name);
            if (q?.read_quality === "none") return { id: doc.id, read_warning: "unreadable", read_note: q.note };
            if (q?.read_quality === "partial") return { id: doc.id, read_warning: "partial", read_note: q.note };
            return { id: doc.id, read_warning: null, read_note: null };
          }),
        },
      })
      .throwOnError();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Analysis ${runId} failed:`, message);
    await db.rpc("fail_analysis", { p_run: runId, p_error: message.slice(0, 500) });
  }
}

async function loadDocument(
  db: ReturnType<typeof createAdminClient>,
  doc: TenderDocument,
): Promise<LoadedFile> {
  const { data, error } = await db.storage.from(BUCKET).download(doc.storage_path);
  if (error || !data) return { ok: false, name: doc.file_name, note: "הקובץ לא נמצא באחסון" };
  return convertFile(doc.file_name, doc.file_type, Buffer.from(await data.arrayBuffer()));
}

// The current content of an existing item, in the AI's shape (for comparing and "before")
type Values = Record<string, string | null>;

type ExistingItem = MissingItem & {
  manual: boolean;
  values: Values;
  // A task linked to a deadline takes its date from the deadline
  linked?: boolean;
  // A task's type: only submission and clarification tasks have a details line
  taskType?: string;
};

// The items the tender already has, as text for the AI (no assignees or other internal data),
// with short ids (R1, D1, T1, I1) that map back to the database rows
async function loadExisting(db: Admin, tenderId: string) {
  const [req, dl, tasks, issues] = await Promise.all([
    db.from("requirements").select("id, text, is_manual").eq("tender_id", tenderId).order("sort_order"),
    db.from("deadlines").select("id, type, title, due_at, has_time, is_manual, is_auto").eq("tender_id", tenderId).order("due_at"),
    db
      .from("tasks")
      .select("id, deadline_id, title, details, type, due_at, has_time, is_manual")
      .eq("tender_id", tenderId)
      .order("sort_order"),
    db
      .from("issues")
      .select("id, category, title, explanation, suggested_question, is_manual")
      .eq("tender_id", tenderId)
      .order("sort_order"),
  ]);
  const failed = [req, dl, tasks, issues].find((x) => x.error);
  if (failed?.error) throw new Error(`existing items: ${failed.error.message}`);

  const items = new Map<string, ExistingItem>();
  const shortOf = new Map<string, string>();
  const lines: string[] = [];
  const add = (prefix: string, item: ExistingItem, text: string) => {
    const short = `${prefix}${items.size + 1}`;
    items.set(short, { ...item, label: item.label.slice(0, 200) });
    shortOf.set(item.item_id, short);
    lines.push(`${short} | ${text}`);
  };
  const when = (iso: string | null, hasTime: boolean) => (iso ? formatDue(iso, hasTime) : "בלי תאריך");
  const parts = (iso: string | null, hasTime: boolean) => {
    if (!iso) return { date: null, time: null };
    const p = isoToIsraelParts(iso);
    return { date: p.date, time: hasTime ? p.time : null };
  };
  const dateText = (v: { date: string | null; time: string | null }) =>
    v.date ? `תאריך: ${v.date} | שעה: ${v.time ?? "לא צוינה"}` : "בלי תאריך";

  for (const x of req.data!) {
    add("R", { item_type: "requirement", item_id: x.id, label: x.text, manual: x.is_manual, values: { text: x.text } }, x.text);
  }
  // The automatic closing meeting is not in the documents
  for (const x of dl.data!.filter((d) => !d.is_auto)) {
    const v = parts(x.due_at, x.has_time);
    add(
      "D",
      {
        item_type: "deadline",
        item_id: x.id,
        label: `${x.title} · ${when(x.due_at, x.has_time)}`,
        manual: x.is_manual,
        values: { title: x.title, ...v },
      },
      `${DEADLINE_TYPE_LABELS[x.type as DeadlineType]} | ${x.title} | ${dateText(v)}`,
    );
  }
  for (const x of tasks.data!.filter((t) => t.type !== "closing_meeting")) {
    const v = parts(x.due_at, x.has_time);
    const link = x.deadline_id ? shortOf.get(x.deadline_id) : undefined;
    add(
      "T",
      {
        item_type: "task",
        item_id: x.id,
        label: `${x.title} · ${when(x.due_at, x.has_time)}`,
        manual: x.is_manual,
        values: { title: x.title, details: x.details, ...v },
        linked: Boolean(x.deadline_id),
        taskType: x.type,
      },
      [
        x.title,
        dateText(v),
        ...(link ? [`מקושרת ל-${link}`] : []),
        ...(DETAIL_TYPES.has(x.type) ? [`פירוט: ${x.details ? x.details.replace(/\n/g, " / ") : "אין"}`] : []),
      ].join(" | "),
    );
  }
  for (const x of issues.data!) {
    const label = `${ISSUE_CATEGORY_LABELS[x.category as IssueCategory]}: ${x.title}`;
    add(
      "I",
      {
        item_type: "issue",
        item_id: x.id,
        label,
        manual: x.is_manual,
        values: { title: x.title, explanation: x.explanation, suggested_question: x.suggested_question },
      },
      `${label} | הסבר: ${x.explanation} | שאלה: ${x.suggested_question}`,
    );
  }
  return { text: lines.join("\n"), items };
}

// The fields the AI may change, per item type; "date" stands for the date and time together
const CHANGE_FIELDS: Record<ItemType, string[]> = {
  requirement: ["text"],
  deadline: ["title", "date"],
  task: ["title", "details", "date"],
  issue: ["title", "explanation", "suggested_question"],
};

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").replace(/\s+/g, " ").trim() === (b ?? "").replace(/\s+/g, " ").trim();

// Keeps the AI's changes that really change something: payload = only the changed fields
// (+ reason, + the new source), old_payload = their old values
function buildChanges(items: Map<string, ExistingItem>, raw: AiChange[]) {
  const seen = new Set<string>();
  return raw.flatMap((c) => {
    const item = items.get(c.id.trim().toUpperCase());
    if (!item || seen.has(item.item_id)) return [];
    const old = item.values;
    const payload: Record<string, string | null | SourceRef[]> = {};
    const before: Values = {};
    for (const field of CHANGE_FIELDS[item.item_type]) {
      if (field === "date") {
        // A linked task's date comes from its deadline; a missing new date is not a change
        if (item.linked || !c.date || !/^\d{4}-\d{2}-\d{2}$/.test(c.date)) continue;
        const time = c.time && /^\d{2}:\d{2}$/.test(c.time) ? c.time : null;
        // Same date with the time left out is not a change
        if (c.date === old.date && (time === old.time || time === null)) continue;
        payload.date = c.date;
        payload.time = time;
        before.date = old.date;
        before.time = old.time;
        continue;
      }
      if (field === "details" && !DETAIL_TYPES.has(item.taskType ?? "")) continue;
      const next = c[field as keyof AiChange] as string | null;
      // An empty value never wipes out existing content
      if (!next || !next.trim() || same(next, old[field])) continue;
      payload[field] = next.trim();
      before[field] = old[field];
    }
    if (Object.keys(payload).length === 0) return [];
    seen.add(item.item_id);
    if (c.source_refs.length > 0) payload.source_refs = c.source_refs;
    // The short ids are internal; drop any that slipped into the reason
    payload.reason = c.reason
      .replace(/\s*\(?\b[RDTI]\d+\b\)?/g, "")
      .replace(/\s+([.,;])/g, "$1")
      .trim();
    // name: the item's title at analysis time, for the dialog's heading of the change
    return [
      { item_type: item.item_type, target_id: item.item_id, payload, old_payload: { ...before, name: old.title ?? null } },
    ];
  });
}
