import { createClient } from "@/lib/db/client";
import { BUCKET, fileTypeFromName, storagePath } from "@/lib/tenders";
import type { TenderDocument } from "@/lib/types";

// Uploads straight from the browser to Storage, then records the file in tender_documents
export async function uploadDocument(tenderId: string, file: File): Promise<boolean> {
  const fileType = fileTypeFromName(file.name);
  if (!fileType) return false;

  const supabase = createClient();
  const id = crypto.randomUUID();
  const path = storagePath(tenderId, id, file.name);

  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
  });
  if (upload.error) return false;

  const row = await supabase.from("tender_documents").insert({
    id,
    tender_id: tenderId,
    file_name: file.name,
    storage_path: path,
    file_type: fileType,
  });
  if (row.error) {
    // Do not leave an orphan file behind
    await supabase.storage.from(BUCKET).remove([path]);
    return false;
  }
  return true;
}

// A deleted document that was added after the first analysis leaves its change reports
// view-only: what still waits for approval in the re-analyses that read it is rejected.
// The reports stay, and items already approved stay in the tender.
async function closeReportsOf(doc: TenderDocument): Promise<boolean> {
  const supabase = createClient();
  const first = await supabase
    .from("analysis_runs")
    .select("started_at")
    .eq("tender_id", doc.tender_id)
    .eq("status", "done")
    .eq("is_reanalysis", false)
    .order("started_at")
    .limit(1)
    .maybeSingle();
  if (first.error) return false;
  if (!first.data || new Date(doc.created_at) <= new Date(first.data.started_at)) return true;

  const runs = await supabase
    .from("analysis_runs")
    .select("id")
    .eq("tender_id", doc.tender_id)
    .eq("is_reanalysis", true)
    .neq("status", "running")
    .gt("started_at", doc.created_at);
  if (runs.error) return false;
  if (runs.data.length === 0) return true;

  const { error } = await supabase
    .from("analysis_proposals")
    .update({ status: "rejected" })
    .eq("status", "pending")
    .in("run_id", runs.data.map((r) => r.id));
  return !error;
}

// Storage first, then the reports, then the row, so a failure never hides a file that
// still exists and the delete can be tried again
export async function deleteDocument(doc: TenderDocument): Promise<boolean> {
  const supabase = createClient();
  const removed = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  if (removed.error) return false;
  if (!(await closeReportsOf(doc))) return false;
  const { error } = await supabase.from("tender_documents").delete().eq("id", doc.id);
  return !error;
}

// Removes every file in the tender's folder (including leftovers of failed uploads),
// then the tender row; its documents go with it (on delete cascade)
export async function deleteTender(tenderId: string): Promise<boolean> {
  const supabase = createClient();
  const listed = await supabase.storage.from(BUCKET).list(tenderId, { limit: 1000 });
  if (listed.error) return false;
  const paths = listed.data.map((f) => `${tenderId}/${f.name}`);
  if (paths.length > 0) {
    const removed = await supabase.storage.from(BUCKET).remove(paths);
    if (removed.error) return false;
  }
  const { error } = await supabase.from("tenders").delete().eq("id", tenderId);
  return !error;
}
