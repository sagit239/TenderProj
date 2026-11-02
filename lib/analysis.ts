import type { DeadlineType, IssueCategory, ItemType, SourceRef, Task, TaskType, TenderAnalysis } from "@/lib/types";

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  submission: "הגשת מכרז",
  bidders_meeting: "מפגש מציעים",
  clarification_questions: "הגשת שאלות הבהרה",
  closing_meeting: "פגישת סגירת פינות",
  other: "מועד אחר",
};

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  threshold: "תנאי סף",
  guarantees: "ערבויות",
  penalties: "קנסות",
  liability: "אחריות ושיפוי",
  insurance: "ביטוח",
  payment_terms: "תנאי תשלום",
  one_sided: "סעיף חד-צדדי",
  contradictions: "סתירות בין מסמכים",
};

// An analysis "running" for more than 5 minutes is treated as failed (PRD edge cases)
export const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;

export function isAnalysisRunning(t: TenderAnalysis, now = Date.now()) {
  return (
    t.analysis_status === "running" &&
    t.analysis_started_at !== null &&
    now - new Date(t.analysis_started_at).getTime() < ANALYSIS_TIMEOUT_MS
  );
}

export function isAnalysisFailed(t: TenderAnalysis, now = Date.now()) {
  return t.analysis_status === "failed" || (t.analysis_status === "running" && !isAnalysisRunning(t, now));
}

// "חוזה.pdf · עמ' 3, סעיף 1.4"
export function formatSourceRef(ref: SourceRef) {
  const where = [ref.page ? `עמ' ${ref.page}` : null, ref.section ? `סעיף ${ref.section}` : null]
    .filter(Boolean)
    .join(", ");
  return where ? `${ref.file_name} · ${where}` : ref.file_name;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// dd/mm/yyyy, plus HH:MM when the deadline has a time (Israel time)
export function formatDue(iso: string, hasTime: boolean) {
  const d = new Date(iso);
  return hasTime ? `${dateFormatter.format(d)} ${timeFormatter.format(d)}` : dateFormatter.format(d);
}

// Starts the background analysis; the server answers right away (202), or 409 if one is running
export async function startAnalysis(tenderId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/tenders/${tenderId}/analyze`, { method: "POST" });
    return res.status === 202 || res.status === 409;
  } catch {
    return false;
  }
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  requirement: "דרישה",
  deadline: "מועד",
  task: "משימה",
  issue: "סעיף בעייתי",
};

// Overdue is computed for display only: due date passed and not done (F8)
export function isOverdue(t: Pick<Task, "due_at" | "is_done">, now = Date.now()) {
  return !t.is_done && t.due_at !== null && new Date(t.due_at).getTime() < now;
}

// Task types whose reminders follow fixed rules; "other" and "regular" use remind_at
export function hasFixedReminders(type: TaskType) {
  return type !== "other" && type !== "regular";
}

// The planned reminder timing shown in the tasks table (ARCHITECTURE: reminder rules)
export function reminderLabel(t: Pick<Task, "type" | "has_time" | "remind_at">) {
  switch (t.type) {
    case "submission":
      return t.has_time ? "יום ו-3 ש׳ לפני" : "יום לפני";
    case "bidders_meeting":
      return "3 ימים לפני";
    case "clarification_questions":
      return "יום לפני";
    case "closing_meeting":
      return "בבוקר יום הפגישה";
    default:
      return t.remind_at ? formatShort(t.remind_at) : null;
  }
}

// Long version for the task dialog, where a fixed type shows its timing as text
export const FIXED_REMINDER_TEXT: Partial<Record<TaskType, string>> = {
  submission: "תזכורות יישלחו יום לפני ההגשה ו-3 שעות לפני.",
  bidders_meeting: "תזכורת תישלח 3 ימים לפני, ותזכורת נוספת יום לפני אם המשימה לא בוצעה.",
  clarification_questions: "תזכורת תישלח יום לפני.",
  closing_meeting: "תזכורת תישלח ב-08:00 ביום הפגישה.",
};

const shortFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "12/11 08:00" (Israel time)
export function formatShort(iso: string) {
  return shortFormatter.format(new Date(iso)).replace(",", "");
}

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function israelParts(ms: number) {
  const p = Object.fromEntries(partsFormatter.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

// Offset of Israel time from UTC at a given moment, in ms
function israelOffset(ms: number) {
  const { date, time } = israelParts(ms);
  return Date.parse(`${date}T${time}:00Z`) - Math.floor(ms / 60000) * 60000;
}

// Date ("YYYY-MM-DD") and optional time ("HH:MM") in Israel time -> ISO string.
// No time means 08:00, like israel_ts() in the database.
export function israelTimeToIso(date: string, time: string | null) {
  const wall = Date.parse(`${date}T${time || "08:00"}:00Z`);
  let ms = wall - israelOffset(wall);
  ms = wall - israelOffset(ms);
  return new Date(ms).toISOString();
}

// ISO -> date and time fields in Israel time (for editing)
export function isoToIsraelParts(iso: string) {
  return israelParts(new Date(iso).getTime());
}
