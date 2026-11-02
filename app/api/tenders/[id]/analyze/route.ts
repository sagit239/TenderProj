import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { convertFile, type LoadedFile } from "@/lib/files";
import { analyzeTender } from "@/lib/ai/analyze";
import { BUCKET } from "@/lib/tenders";
import type { TenderDocument } from "@/lib/types";

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

async function runAnalysis(tenderId: string, runId: string) {
  const db = createAdminClient();
  try {
    const { data: docs, error } = await db
      .from("tender_documents")
      .select("*")
      .eq("tender_id", tenderId)
      .order("created_at");
    if (error) throw new Error(`documents: ${error.message}`);

    const loaded = await Promise.all((docs as TenderDocument[]).map((doc) => loadDocument(db, doc)));
    const readable = loaded.flatMap((f) => (f.ok ? [f] : []));
    if (readable.length === 0) throw new Error("no readable files");

    const out = await analyzeTender(readable);
    const r = out.result;
    const quality = new Map(r.documents.map((d) => [d.file_name, d]));

    await db
      .rpc("save_analysis", {
        p_run: runId,
        p_result: {
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
