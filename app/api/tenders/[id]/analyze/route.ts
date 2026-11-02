import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { convertFile, type LoadedFile } from "@/lib/files";
import { analyzeTender } from "@/lib/ai/analyze";
import { BUCKET } from "@/lib/tenders";
import { DEADLINE_TYPE_LABELS, ISSUE_CATEGORY_LABELS, formatDue } from "@/lib/analysis";
import type { DeadlineType, IssueCategory, ItemType, MissingItem, TenderDocument } from "@/lib/types";

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
    // Only items that came from the documents can be "not found again"
    const missing = existing
      ? [...new Set(r.missing_ids)].flatMap((short) => {
          const item = existing.items.get(short.trim().toUpperCase());
          return item && !item.manual ? [{ item_type: item.item_type, item_id: item.item_id, label: item.label }] : [];
        })
      : [];

    await db
      .rpc(existing ? "save_reanalysis" : "save_analysis", {
        p_run: runId,
        p_result: {
          missing,
          model: out.model,
          input_tokens: out.inputTokens,
          output_tokens: out.outputTokens,
          requirements: r.requirements.map((x) => x.text),
          deadlines: r.deadlines,
          tasks: r.tasks,
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

type ExistingItem = MissingItem & { manual: boolean };

// The items the tender already has, as text for the AI (no assignees or other internal data),
// with short ids (R1, D1, T1, I1) that map back to the database rows
async function loadExisting(db: Admin, tenderId: string) {
  const [req, dl, tasks, issues] = await Promise.all([
    db.from("requirements").select("id, text, is_manual").eq("tender_id", tenderId).order("sort_order"),
    db.from("deadlines").select("id, type, title, due_at, has_time, is_manual, is_auto").eq("tender_id", tenderId).order("due_at"),
    db.from("tasks").select("id, title, type, due_at, has_time, is_manual").eq("tender_id", tenderId).order("sort_order"),
    db.from("issues").select("id, category, title, explanation, is_manual").eq("tender_id", tenderId).order("sort_order"),
  ]);
  const failed = [req, dl, tasks, issues].find((x) => x.error);
  if (failed?.error) throw new Error(`existing items: ${failed.error.message}`);

  const items = new Map<string, ExistingItem>();
  const lines: string[] = [];
  const add = (prefix: string, item_type: ItemType, item_id: string, label: string, manual: boolean, text = label) => {
    const short = `${prefix}${items.size + 1}`;
    items.set(short, { item_type, item_id, label: label.slice(0, 200), manual });
    lines.push(`${short} | ${text}`);
  };
  const when = (iso: string | null, hasTime: boolean) => (iso ? formatDue(iso, hasTime) : "בלי תאריך");

  for (const x of req.data!) add("R", "requirement", x.id, x.text, x.is_manual);
  // The automatic closing meeting is not in the documents
  for (const x of dl.data!.filter((d) => !d.is_auto)) {
    const label = `${x.title} · ${when(x.due_at, x.has_time)}`;
    add("D", "deadline", x.id, label, x.is_manual, `${DEADLINE_TYPE_LABELS[x.type as DeadlineType]} | ${label}`);
  }
  for (const x of tasks.data!.filter((t) => t.type !== "closing_meeting")) {
    add("T", "task", x.id, `${x.title} · ${when(x.due_at, x.has_time)}`, x.is_manual);
  }
  for (const x of issues.data!) {
    const label = `${ISSUE_CATEGORY_LABELS[x.category as IssueCategory]}: ${x.title}`;
    add("I", "issue", x.id, label, x.is_manual, `${label} — ${x.explanation}`);
  }
  return { text: lines.join("\n"), items };
}
