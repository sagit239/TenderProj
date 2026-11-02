import type { DeadlineType, IssueCategory, SourceRef, TenderAnalysis } from "@/lib/types";

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
