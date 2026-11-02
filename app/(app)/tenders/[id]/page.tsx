import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisBanner } from "@/components/tenders/AnalysisBanner";
import { EmptyCard, IssuesTab, RequirementsTab, TasksTab, TimelineTab } from "@/components/tenders/AnalysisTabs";
import { DocumentsTab } from "@/components/tenders/DocumentsTab";
import { TenderHeader } from "@/components/tenders/TenderHeader";
import { Tabs } from "@/components/ui/Tabs";
import { createClient } from "@/lib/db/server";
import { isTenderList, listForStatus, tenderHref } from "@/lib/tenders";
import { isAnalysisRunning } from "@/lib/analysis";
import type {
  Deadline,
  DocumentReadState,
  Issue,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const [tenderResult, docsResult] = await Promise.all([
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
  ]);
  if (tenderResult.error) throw new Error("Could not load the tender");
  if (!tenderResult.data) notFound();

  const tender = tenderResult.data as Tender & TenderAnalysis;
  const documents = (docsResult.data ?? []) as (TenderDocument & DocumentReadState)[];
  // Breadcrumb goes back to the list the user came from; without it, the tender's current list
  const from = isTenderList(query.from) ? query.from : listForStatus(tender.status);
  const tab = TABS.find((t) => t.key === query.tab) ?? TABS[0];
  const content = tab.key === "documents" ? null : await loadTab(supabase, tender, tab.key);

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
        documentsHref={tenderHref(tender.id, from, "documents")}
      />
      {tab.key === "documents" ? (
        <DocumentsTab
          tenderId={tender.id}
          documents={documents}
          loadFailed={Boolean(docsResult.error)}
          analysis={tender}
        />
      ) : (
        content
      )}
    </>
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fetches only what the active tab shows
async function loadTab(supabase: Supabase, tender: Tender & TenderAnalysis, tab: string) {
  const heading = TABS.find((t) => t.key === tab)!.heading;
  if (tender.analysis_status !== "done") {
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

  if (tab === "timeline") {
    const { data, error } = await supabase
      .from("deadlines")
      .select("id, type, title, due_at, has_time, source_refs, is_manual, is_auto")
      .eq("tender_id", tender.id)
      .order("due_at");
    if (error) throw new Error("Could not load deadlines");
    return <TimelineTab items={data as Deadline[]} />;
  }
  if (tab === "tasks") {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, type, due_at, has_time, sort_order")
      .eq("tender_id", tender.id)
      .order("due_at", { nullsFirst: false })
      .order("sort_order");
    if (error) throw new Error("Could not load tasks");
    return <TasksTab items={data as Task[]} />;
  }
  if (tab === "issues") {
    const { data, error } = await supabase
      .from("issues")
      .select("id, category, title, explanation, source_refs, suggested_question")
      .eq("tender_id", tender.id)
      .order("sort_order");
    if (error) throw new Error("Could not load issues");
    return <IssuesTab items={data as Issue[]} />;
  }
  const { data, error } = await supabase
    .from("requirements")
    .select("id, text, sort_order")
    .eq("tender_id", tender.id)
    .order("sort_order");
  if (error) throw new Error("Could not load requirements");
  return <RequirementsTab items={data as Requirement[]} />;
}
