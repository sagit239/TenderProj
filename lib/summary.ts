import "server-only";
import { DEADLINE_TYPE_LABELS, ISSUE_CATEGORY_LABELS, formatDue, formatSourceRef, isOverdue } from "@/lib/analysis";
import type { createClient } from "@/lib/db/server";
import { departmentLabel, statusLabel } from "@/lib/tenders";
import type { Deadline, Issue, SummaryPart, Tender, TenderSummary } from "@/lib/types";

// One source for the Word export, the print page and the email draft (ADR-22),
// so all three show the same content and wording.

export const SUMMARY_PARTS: { key: SummaryPart; label: string }[] = [
  { key: "requirements", label: "סיכום דרישות" },
  { key: "deadlines", label: "לוח זמנים" },
  { key: "tasks", label: "משימות" },
  { key: "issues", label: "סעיפים בעייתיים" },
];

export const EMPTY_PART_TEXT = "אין פריטים";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const sources = (refs: Issue["source_refs"]) => refs.map(formatSourceRef).join(" / ");

type TaskRow = {
  deadline_id: string | null;
  title: string;
  due_at: string | null;
  has_time: boolean;
  is_done: boolean;
  task_assignees: { team_member_id: string }[];
};

// Same wording as the "לוח זמנים" tab
function deadlineSource(d: Deadline) {
  if (d.is_auto && !d.is_manual) return "אוטומטי (3 ימי עבודה לפני ההגשה)";
  if (d.source_refs.length > 0) return sources(d.source_refs);
  return d.is_manual ? "ידני" : "—";
}

// Loads the tender and its four parts with the signed-in user's client (RLS); null if not found
export async function loadTenderSummary(supabase: Supabase, tenderId: string): Promise<TenderSummary | null> {
  const [tender, requirements, deadlines, tasks, members, issues] = await Promise.all([
    supabase.from("tenders").select("id, name, department, status").eq("id", tenderId).maybeSingle(),
    supabase.from("requirements").select("text").eq("tender_id", tenderId).order("sort_order"),
    supabase
      .from("deadlines")
      .select("id, type, title, due_at, has_time, source_refs, is_manual, is_auto")
      .eq("tender_id", tenderId)
      .order("due_at"),
    supabase
      .from("tasks")
      .select("deadline_id, title, due_at, has_time, is_done, task_assignees(team_member_id)")
      .eq("tender_id", tenderId)
      .order("due_at", { nullsFirst: false })
      .order("sort_order"),
    supabase.from("team_members").select("id, name"),
    supabase
      .from("issues")
      .select("category, title, explanation, source_refs, suggested_question")
      .eq("tender_id", tenderId)
      .order("sort_order"),
  ]);
  if (tender.error || requirements.error || deadlines.error || tasks.error || members.error || issues.error) {
    throw new Error("Could not load the tender summary");
  }
  if (!tender.data) return null;

  const t = tender.data as Pick<Tender, "id" | "name" | "department" | "status">;
  const names = new Map((members.data as { id: string; name: string }[]).map((m) => [m.id, m.name]));
  const now = Date.now();
  const taskRows = tasks.data as TaskRow[];
  const progress = (task: TaskRow | undefined) => {
    const assignees = (task?.task_assignees ?? []).map((a) => names.get(a.team_member_id)).filter(Boolean);
    return {
      assignees: assignees.length > 0 ? assignees.join(", ") : "לא משויך",
      state: task?.is_done ? "בוצע" : task && isOverdue(task, now) ? "באיחור" : "פתוח",
    };
  };

  return {
    id: t.id,
    name: t.name,
    department: departmentLabel(t.department),
    status: statusLabel(t.status),
    requirements: (requirements.data as { text: string }[]).map((r) => r.text),
    deadlines: (deadlines.data as Deadline[]).map((d) => ({
      type: DEADLINE_TYPE_LABELS[d.type],
      title: d.title,
      due: formatDue(d.due_at, d.has_time),
      ...progress(taskRows.find((task) => task.deadline_id === d.id)),
      source: deadlineSource(d),
    })),
    // What is on the timeline appears once, in the "לוח זמנים" part
    tasks: taskRows
      .filter((task) => !task.deadline_id)
      .map((task) => ({
        title: task.title,
        due: task.due_at ? formatDue(task.due_at, task.has_time) : "—",
        ...progress(task),
      })),
    issues: (issues.data as Omit<Issue, "id" | "is_manual" | "sort_order">[]).map((i) => ({
      category: ISSUE_CATEGORY_LABELS[i.category],
      title: i.title,
      explanation: i.explanation,
      source: sources(i.source_refs),
      question: i.suggested_question,
    })),
  };
}

// Plain-text lines of one part, for the email draft
function partLines(s: TenderSummary, part: SummaryPart): string[] {
  const lines =
    part === "requirements"
      ? s.requirements.map((r) => `• ${r}`)
      : part === "deadlines"
        ? s.deadlines.map((d) => `• ${d.title} (${d.type}): ${d.due} · אחראים: ${d.assignees} · ${d.state}`)
        : part === "tasks"
          ? s.tasks.map((t) => `• ${t.title} · מועד: ${t.due} · אחראים: ${t.assignees} · ${t.state}`)
          : s.issues.flatMap((i) => [
              `• ${i.category}: ${i.title}`,
              `  ${i.explanation}`,
              ...(i.source ? [`  מקור: ${i.source}`] : []),
              ...(i.question ? [`  שאלת הבהרה: ${i.question}`] : []),
            ]);
  return lines.length > 0 ? lines : [EMPTY_PART_TEXT];
}

// The text of each part: a heading line and the items under it
export function summaryPartsText(s: TenderSummary): Record<SummaryPart, string> {
  return Object.fromEntries(
    SUMMARY_PARTS.map((p) => [p.key, [`${p.label}:`, ...partLines(s, p.key)].join("\n")]),
  ) as Record<SummaryPart, string>;
}
