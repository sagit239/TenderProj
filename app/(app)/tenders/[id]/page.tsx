import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisBanner } from "@/components/tenders/AnalysisBanner";
import { DocumentsTab } from "@/components/tenders/DocumentsTab";
import { IssuesTab } from "@/components/tenders/IssuesTab";
import { ReanalysisDialog } from "@/components/tenders/ReanalysisDialog";
import { RequirementsTab } from "@/components/tenders/RequirementsTab";
import { ScrollToItem } from "@/components/tenders/ScrollToItem";
import { EmptyCard } from "@/components/tenders/TabParts";
import { TasksTab } from "@/components/tenders/TasksTab";
import { TenderHeader } from "@/components/tenders/TenderHeader";
import { TimelineTab } from "@/components/tenders/TimelineTab";
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
    tab.key === "documents" ? null : hasAnalysis ? await loadTab(supabase, tender.id, tab.key) : emptyTab(tender, tab.heading);

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
async function loadTab(supabase: Supabase, tenderId: string, tab: string) {
  if (tab === "timeline") {
    const { data, error } = await supabase
      .from("deadlines")
      .select("id, type, title, due_at, has_time, source_refs, is_manual, is_auto")
      .eq("tender_id", tenderId)
      .order("due_at");
    if (error) throw new Error("Could not load deadlines");
    return <TimelineTab tenderId={tenderId} items={data as Deadline[]} />;
  }
  if (tab === "tasks") {
    const [tasks, members, deadlines] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, deadline_id, title, type, due_at, has_time, is_done, remind_at, reminders_off, is_manual, sort_order, task_assignees(team_member_id)")
        .eq("tender_id", tenderId)
        .order("due_at", { nullsFirst: false })
        .order("sort_order"),
      supabase.from("team_members").select("id, name").order("name"),
      supabase.from("deadlines").select("id, title").eq("tender_id", tenderId),
    ]);
    if (tasks.error || members.error || deadlines.error) throw new Error("Could not load tasks");
    const items = (tasks.data as (Omit<Task, "assignee_ids"> & { task_assignees: { team_member_id: string }[] })[]).map(
      ({ task_assignees, ...t }) => ({ ...t, assignee_ids: task_assignees.map((a) => a.team_member_id) }),
    );
    return <TasksTab tenderId={tenderId} items={items} members={members.data} deadlines={deadlines.data} />;
  }
  if (tab === "issues") {
    const { data, error } = await supabase
      .from("issues")
      .select("id, category, title, explanation, source_refs, suggested_question, is_manual, sort_order")
      .eq("tender_id", tenderId)
      .order("sort_order");
    if (error) throw new Error("Could not load issues");
    return <IssuesTab tenderId={tenderId} items={data as Issue[]} />;
  }
  const { data, error } = await supabase
    .from("requirements")
    .select("id, text, sort_order, is_manual")
    .eq("tender_id", tenderId)
    .order("sort_order");
  if (error) throw new Error("Could not load requirements");
  return <RequirementsTab tenderId={tenderId} items={data as Requirement[]} />;
}

// The run's proposals, and links to the "not found again" items that still exist
async function loadReport(supabase: Supabase, report: ReanalysisRun, tenderId: string, from: TenderList) {
  const { data, error } = await supabase
    .from("analysis_proposals")
    .select("id, run_id, item_type, payload, status, sort_order")
    .eq("run_id", report.id)
    .order("sort_order");
  if (error) throw new Error("Could not load the change report");

  const missing = report.change_report?.missing ?? [];
  const itemHrefs: Record<string, string> = {};
  await Promise.all(
    (Object.keys(ITEM_PLACES) as ItemType[]).map(async (type) => {
      const ids = missing.filter((m) => m.item_type === type).map((m) => m.item_id);
      if (ids.length === 0) return;
      const { data: found } = await supabase.from(ITEM_PLACES[type].table).select("id").in("id", ids);
      for (const row of (found ?? []) as { id: string }[]) {
        itemHrefs[row.id] = `${tenderHref(tenderId, from, ITEM_PLACES[type].tab)}#item-${row.id}`;
      }
    }),
  );
  return { proposals: data as AnalysisProposal[], itemHrefs };
}
