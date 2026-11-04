import "server-only";
import type { createClient } from "@/lib/db/server";
import { ACTIVE_STATUSES } from "@/lib/tenders";
import type { FailedReminder } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type FailedRow = {
  id: string;
  recipient_email: string | null;
  error: string | null;
  tasks: { title: string; tenders: { name: string } };
};

// Unhandled failures of active tenders only; a tender that left the active list no longer needs them
export async function loadFailedReminders(supabase: Supabase): Promise<FailedReminder[]> {
  const { data } = await supabase
    .from("reminders")
    .select("id, recipient_email, error, tasks!inner(title, tenders!inner(name))")
    .eq("status", "failed")
    .is("handled_at", null)
    .in("tasks.tenders.status", ACTIVE_STATUSES)
    .order("send_at", { ascending: false });
  return ((data ?? []) as unknown as FailedRow[]).map((r) => ({
    id: r.id,
    recipient_email: r.recipient_email,
    error: r.error,
    task_title: r.tasks.title,
    tender_name: r.tasks.tenders.name,
  }));
}
