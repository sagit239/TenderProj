import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentsTab } from "@/components/tenders/DocumentsTab";
import { TenderHeader } from "@/components/tenders/TenderHeader";
import { Tabs } from "@/components/ui/Tabs";
import { createClient } from "@/lib/db/server";
import { isTenderList, listForStatus, tenderHref } from "@/lib/tenders";
import type { Tender, TenderDocument } from "@/lib/types";

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
      .select("id, name, department, status, decided_at, submitted_at, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("tender_documents")
      .select("id, tender_id, file_name, storage_path, file_type, created_at")
      .eq("tender_id", id)
      .order("created_at"),
  ]);
  if (tenderResult.error) throw new Error("Could not load the tender");
  if (!tenderResult.data) notFound();

  const tender = tenderResult.data as Tender;
  // Breadcrumb goes back to the list the user came from; without it, the tender's current list
  const from = isTenderList(query.from) ? query.from : listForStatus(tender.status);
  const tab = TABS.find((t) => t.key === query.tab) ?? TABS[0];

  return (
    <>
      <TenderHeader tender={tender} from={from} />
      <Tabs
        label="חלקי המכרז"
        active={tab.key}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: tenderHref(tender.id, from, t.key) }))}
      />
      {tab.key === "documents" ? (
        <DocumentsTab
          tenderId={tender.id}
          documents={(docsResult.data ?? []) as TenderDocument[]}
          loadFailed={Boolean(docsResult.error)}
        />
      ) : (
        <section aria-labelledby="tab-heading">
          <h2 id="tab-heading" className="mb-3 text-h3">
            {tab.heading}
          </h2>
          <div className="rounded-card border border-line bg-white px-6 py-10 text-center shadow-card">
            <p className="text-body text-muted">עדיין אין תוכן. הוא יופיע כאן אחרי ניתוח המכרז.</p>
          </div>
        </section>
      )}
    </>
  );
}
