import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisBanner } from "@/components/tenders/AnalysisBanner";
import { DocumentsTab } from "@/components/tenders/DocumentsTab";
import { IssuesTab } from "@/components/tenders/IssuesTab";
import { ReanalysisDialog } from "@/components/tenders/ReanalysisDialog";
import { RequirementsTab, type RequirementTask } from "@/components/tenders/RequirementsTab";
import { ScrollToItem } from "@/components/tenders/ScrollToItem";
import { EmptyCard } from "@/components/tenders/TabParts";
import { TasksTab } from "@/components/tenders/TasksTab";
import { TenderHeader } from "@/components/tenders/TenderHeader";
import { TimelineTab, type TimelineTask } from "@/components/tenders/TimelineTab";
import { Tabs } from "@/components/ui/Tabs";
import { createClient } from "@/lib/db/server";
import { isTenderList, listForStatus, tenderHref, type TenderList } from "@/lib/tenders";
import { isAnalysisRunning } from "@/lib/analysis";
import type {
  AnalysisProposal,
  ChangeReport,
  Deadline,
  DocumentReadState,
  Issue,
  ItemType,
  ReanalysisRun,
  Requirement,
  Task,
  Tender,
  TenderAnalysis,
  TenderDocument,
} from "@/lib/types";

export const metadata: Metadata = { title: "מכרז · ניהול מכרזים" };

const TABS = [
  { key: "summary", label: "סיכום דרישות", heading: "סיכום דרישות המכרז" },
  { key: "timeline", label: "לוח זמנים", heading: "מועדי המכרז" },
  { key: "tasks", label: "משימות", heading: "משימות" },
  { key: "issues", label: "סעיפים בעייתיים", heading: "סעיפים בעייתיים" },
  { key: "documents", label: "מסמכים", heading: "מסמכי המכרז" },
];

// The tab and table of each item type, for "מעבר לפריט"
const ITEM_PLACES: Record<ItemType, { tab: string; table: string }> = {
  requirement: { tab: "summary", table: "requirements" },
  deadline: { tab: "timeline", table: "deadlines" },
  task: { tab: "tasks", table: "tasks" },
  issue: { tab: "issues", table: "issues" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Run = {
  id: string;
  status: string;
  is_reanalysis: boolean;
  finished_at: string | null;
  change_report: ChangeReport | null;
  analysis_proposals: { status: string }[];
};

export default async function TenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [tenderResult, docsResult, runsResult] = await Promise.all([
    supabase
      .from("tenders")
      .select("id, name, department, status, decided_at, submitted_at, created_at, analysis_status, analysis_started_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("tender_documents")
      .select("id, tender_id, file_name, storage_path, file_type, created_at, read_warning, read_note, analyzed_at")
      .eq("tender_id", id)
      .order("created_at"),
    supabase
      .from("analysis_runs")
      .select("id, status, is_reanalysis, finished_at, change_report, analysis_proposals(status)")
      .eq("tender_id", id)
      .eq("status", "done")
      .order("finished_at", { ascending: false }),
  ]);
  if (tenderResult.error) throw new Error("Could not load the tender");
  if (!tenderResult.data) notFound();

  const tender = tenderResult.data as Tender & TenderAnalysis;
  const documents = (docsResult.data ?? []) as (TenderDocument & DocumentReadState)[];
  const runs = (runsResult.data ?? []) as Run[];
  // Results stay visible during and after a re-analysis, once any analysis succeeded
  const hasAnalysis = runs.length > 0;
  // Breadcrumb goes back to the list the user came from; without it, the tender's current list
  const from = isTenderList(query.from) ? query.from : listForStatus(tender.status);
  const tab = TABS.find((t) => t.key === query.tab) ?? TABS[0];
  const documentsHref = tenderHref(tender.id, from, "documents");
  const reports: ReanalysisRun[] = runs
    .filter((r) => r.is_reanalysis)
    .map((r) => ({
      id: r.id,
      finished_at: r.finished_at!,
      change_report: r.change_report,
      pending: r.analysis_proposals.filter((p) => p.status === "pending").length,
    }));
  const report = reports.find((r) => r.id === query.report);

  const content =
    tab.key === "documents" ? null : hasAnalysis ? await loadTab(supabase, tender.id, tab.key, from) : emptyTab(tender, tab.heading);

  return (
    <>
      <TenderHeader tender={tender} from={from} />
      <Tabs
        label="חלקי המכרז"
        active={tab.key}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: tenderHref(tender.id, from, t.key) }))}
      />
      <AnalysisBanner
        tenderId={tender.id}
        analysis={tender}
        hasReadWarnings={documents.some((d) => d.read_warning !== null)}
        documentsHref={documentsHref}
      />
      {tab.key === "documents" ? (
        <DocumentsTab
          tenderId={tender.id}
          documents={documents}
          loadFailed={Boolean(docsResult.error)}
          analysis={tender}
          hasAnalysis={hasAnalysis}
          reports={reports}
          documentsHref={documentsHref}
        />
      ) : (
        content
      )}
      <ScrollToItem key={tab.key} />
      {report && (
        <ReanalysisDialog
          key={report.id}
          run={report}
          {...await loadReport(supabase, report, tender.id, from)}
          closeHref={tenderHref(tender.id, from, tab.key)}
        />
      )}
    </>
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function emptyTab(tender: TenderAnalysis, heading: string) {
  const text = isAnalysisRunning(tender)
    ? "הניתוח עדיין רץ. התוכן יופיע כאן כשהוא יסתיים."
    : "עדיין אין תוכן. הוא יופיע כאן אחרי ניתוח המכרז.";
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="mb-3 text-h3">
        {heading}
      </h2>
      <EmptyCard text={text} />
    </section>
  );
}

// Fetches only what the active tab shows
async function loadTab(supabase: Supabase, tenderId: string, tab: string, from: TenderList) {
  if (tab === "timeline") {
    const [deadlines, tasks, members] = await Promise.all([
      supabase
        .from("deadlines")
        .select("id, type, title, due_at, has_time, source_refs, is_manual, is_auto, original")
        .eq("tender_id", tenderId)
        .order("due_at"),
      // The task linked to each deadline holds its assignees and reminder settings
      supabase
        .from("tasks")
        .select("id, deadline_id, type, due_at, has_time, remind_at, reminders_off, task_assignees(team_member_id)")
        .eq("tender_id", tenderId)
        .not("deadline_id", "is", null),
      supabase.from("team_members").select("id, name").order("name"),
    ]);
    if (deadlines.error || tasks.error || members.error) throw new Error("Could not load deadlines");
    const linked = withAssignees(tasks.data as WithRows<TimelineTask>[]);
    return (
      <TimelineTab tenderId={tenderId} items={deadlines.data as Deadline[]} tasks={linked} members={members.data} />
    );
  }
  if (tab === "tasks") {
    const [tasks, members, deadlines, requirements] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, deadline_id, title, details, type, due_at, has_time, is_done, remind_at, reminders_off, is_manual, sort_order, source_refs, requirement_id, original, task_assignees(team_member_id)")
        .eq("tender_id", tenderId)
        .order("due_at", { nullsFirst: false })
        .order("sort_order"),
      supabase.from("team_members").select("id, name").order("name"),
      supabase.from("deadlines").select("id, title").eq("tender_id", tenderId),
      supabase.from("requirements").select("id, text").eq("tender_id", tenderId).order("sort_order"),
    ]);
    if (tasks.error || members.error || deadlines.error || requirements.error) throw new Error("Could not load tasks");
    return (
      <TasksTab
        tenderId={tenderId}
        items={withAssignees(tasks.data as WithRows<Task>[])}
        members={members.data}
        deadlines={deadlines.data}
        requirements={requirements.data}
      />
    );
  }
  if (tab === "issues") {
    const { data, error } = await supabase
      .from("issues")
      .select("id, category, title, explanation, source_refs, suggested_question, is_manual, sort_order, original")
      .eq("tender_id", tenderId)
      .order("sort_order");
    if (error) throw new Error("Could not load issues");
    return <IssuesTab tenderId={tenderId} items={data as Issue[]} />;
  }
  const [requirements, tasks, members] = await Promise.all([
    supabase
      .from("requirements")
      .select("id, text, sort_order, is_manual, source_refs, original")
      .eq("tender_id", tenderId)
      .order("sort_order"),
    supabase
      .from("tasks")
      .select("id, requirement_id, title, type, due_at, has_time, is_done, is_manual, source_refs, original, task_assignees(team_member_id)")
      .eq("tender_id", tenderId)
      .not("requirement_id", "is", null)
      .order("due_at", { nullsFirst: false })
      .order("sort_order"),
    supabase.from("team_members").select("id, name").order("name"),
  ]);
  if (requirements.error || tasks.error || members.error) throw new Error("Could not load requirements");
  return (
    <RequirementsTab
      tenderId={tenderId}
      items={requirements.data as Requirement[]}
      tasks={withAssignees(tasks.data as WithRows<RequirementTask>[])}
      members={members.data}
      tasksHref={tenderHref(tenderId, from, "tasks")}
    />
  );
}

// A task as it comes from the database, with its assignee rows
type WithRows<T> = Omit<T, "assignee_ids"> & { task_assignees: { team_member_id: string }[] };

function withAssignees<T extends { task_assignees: { team_member_id: string }[] }>(rows: T[]) {
  return rows.map(({ task_assignees, ...t }) => ({ ...t, assignee_ids: task_assignees.map((a) => a.team_member_id) }));
}

// The run's proposals, links to the "not found again" and updated items that still exist,
// and the updated deadlines that have a reminder time chosen by hand
async function loadReport(supabase: Supabase, report: ReanalysisRun, tenderId: string, from: TenderList) {
  const { data, error } = await supabase
    .from("analysis_proposals")
    .select("id, run_id, item_type, payload, status, sort_order, target_id, old_payload")
    .eq("run_id", report.id)
    .order("sort_order");
  if (error) throw new Error("Could not load the change report");
  const proposals = data as AnalysisProposal[];

  const linked = [
    ...(report.change_report?.missing ?? []),
    ...proposals.flatMap((p) => (p.target_id ? [{ item_type: p.item_type, item_id: p.target_id }] : [])),
  ];
  const itemHrefs: Record<string, string> = {};
  const deadlineTargets = proposals.filter((p) => p.target_id && p.item_type === "deadline").map((p) => p.target_id!);
  const { data: chosen } = deadlineTargets.length
    ? await supabase.from("tasks").select("deadline_id").in("deadline_id", deadlineTargets).not("remind_at", "is", null)
    : { data: [] };
  const customReminder = ((chosen ?? []) as { deadline_id: string }[]).map((t) => t.deadline_id);
  await Promise.all(
    (Object.keys(ITEM_PLACES) as ItemType[]).map(async (type) => {
      const ids = [...new Set(linked.filter((m) => m.item_type === type).map((m) => m.item_id))];
      if (ids.length === 0) return;
      const { data: found } = await supabase.from(ITEM_PLACES[type].table).select("id").in("id", ids);
      for (const row of (found ?? []) as { id: string }[]) {
        itemHrefs[row.id] = `${tenderHref(tenderId, from, ITEM_PLACES[type].tab)}#item-${row.id}`;
      }
    }),
  );
  return { proposals, itemHrefs, customReminder };
}
