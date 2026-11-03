import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { SEND_FAILURE_TEXT, sendEmail } from "@/lib/email";
import { failureAlertEmail, reminderEmail, type FailedReminderLine } from "@/lib/email/templates";
import { formatDue } from "@/lib/analysis";

// Called every 15 minutes by pg_cron in Production (ADR-2), by hand in Development
export const maxDuration = 60;

type Claimed = { reminder_id: string; reminder_kind: string; member_id: string | null; reminder_task_id: string };

type TaskInfo = {
  id: string;
  title: string;
  due_at: string | null;
  has_time: boolean;
  tenders: { name: string };
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: claimed, error } = await db.rpc("claim_due_reminders");
  if (error) {
    console.error("reminders: claim failed", error.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  const due = (claimed ?? []) as Claimed[];
  if (due.length === 0) return NextResponse.json({ sent: 0, failed: 0 });

  // Addresses are looked up now, so a changed email applies right away (ARCHITECTURE)
  const taskIds = [...new Set(due.map((r) => r.reminder_task_id))];
  const memberIds = [...new Set(due.flatMap((r) => (r.member_id ? [r.member_id] : [])))];
  const [{ data: tasks }, { data: members }] = await Promise.all([
    db.from("tasks").select("id, title, due_at, has_time, tenders(name)").in("id", taskIds),
    memberIds.length
      ? db.from("team_members").select("id, name, email").in("id", memberIds)
      : Promise.resolve({ data: [] as { id: string; name: string; email: string }[] }),
  ]);
  const taskById = new Map(((tasks ?? []) as unknown as TaskInfo[]).map((t) => [t.id, t]));
  const memberById = new Map((members ?? []).map((m) => [m.id, m]));

  let sent = 0;
  const failures: FailedReminderLine[] = [];

  for (const r of due) {
    const task = taskById.get(r.reminder_task_id);
    if (!task) continue; // deleted meanwhile; the reminder went with it
    const member = r.member_id ? memberById.get(r.member_id) : null;
    if (r.member_id && !member) continue; // team member deleted meanwhile
    const to = member ? member.email : (process.env.NOTIFY_EMAIL ?? "");

    const result = await sendEmail(
      reminderEmail(to, {
        recipientName: member?.name ?? null,
        tenderName: task.tenders.name,
        taskTitle: task.title,
        due: task.due_at ? formatDue(task.due_at, task.has_time) : null,
      }),
    );

    if (result.ok) {
      sent++;
      await db
        .from("reminders")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipient_email: to })
        .eq("id", r.reminder_id);
    } else {
      const reason = SEND_FAILURE_TEXT[result.reason];
      console.error(`reminders: ${r.reminder_id} failed: ${result.detail}`);
      failures.push({ tenderName: task.tenders.name, taskTitle: task.title, recipient: to || "—", reason });
      await db
        .from("reminders")
        .update({ status: "failed", recipient_email: to || null, error: reason })
        .eq("id", r.reminder_id);
    }
  }

  // One alert email per run with failures (PRD: the user gets an email about each failure)
  if (failures.length > 0 && process.env.NOTIFY_EMAIL) {
    const alert = await sendEmail(failureAlertEmail(process.env.NOTIFY_EMAIL, failures));
    if (!alert.ok) console.error("reminders: failure alert not sent:", alert.detail);
  }

  return NextResponse.json({ sent, failed: failures.length });
}
