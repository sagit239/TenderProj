import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EMPTY_PART_TEXT, SUMMARY_PARTS, loadTenderSummary } from "@/lib/summary";
import type { SummaryPart, TenderSummary } from "@/lib/types";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "הדפסת סיכום · ניהול מכרזים" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Print page for "PDF (הדפסה)": the four parts without the app shell, saved as PDF from the browser
export default async function PrintTenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  if (!UUID.test(id)) notFound();

  // Outside the (app) layout, so the sign-in check is repeated here after the proxy
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const summary = await loadTenderSummary(supabase, id);
  if (!summary) notFound();

  const exported = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", dateStyle: "short" }).format(new Date());

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/tenders/${summary.id}`}
          className="inline-flex h-11 items-center text-[14px] font-medium text-muted underline-offset-2 hover:text-text hover:underline md:h-auto"
        >
          חזרה למכרז
        </Link>
        <PrintButton auto={auto === "1"} />
      </div>

      <article className="rounded-card border border-line bg-white p-6 shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none md:p-10">
        <header className="mb-6 border-b border-line pb-4">
          <h1 className="text-h1 break-words">{summary.name}</h1>
          <p className="mt-1 text-body text-muted">
            {summary.department} · {summary.status} · יוצא ב-<span dir="ltr">{exported}</span>
          </p>
        </header>
        {SUMMARY_PARTS.map((p) => (
          <section key={p.key} aria-labelledby={`part-${p.key}`} className="mb-8 last:mb-0">
            <h2 id={`part-${p.key}`} className="mb-3 text-h2 print:break-after-avoid">
              {p.label}
            </h2>
            <Part summary={summary} part={p.key} />
          </section>
        ))}
      </article>
    </div>
  );
}

const th = "border border-line bg-table-head px-2 py-1.5 text-start text-small font-semibold text-muted";
const td = "border border-line px-2 py-1.5 align-top text-body break-words";

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[520px] border-collapse print:min-w-0">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="print-keep">
              {r.map((c, j) => (
                <td key={j} className={td}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Part({ summary: s, part }: { summary: TenderSummary; part: SummaryPart }) {
  const empty = <p className="text-body text-muted">{EMPTY_PART_TEXT}</p>;
  if (part === "requirements") {
    return s.requirements.length > 0 ? (
      <ul className="list-disc space-y-1 ps-5 text-body">
        {s.requirements.map((r, i) => (
          <li key={i} className="print-keep break-words">
            {r}
          </li>
        ))}
      </ul>
    ) : (
      empty
    );
  }
  if (part === "deadlines") {
    return s.deadlines.length > 0 ? (
      <Table
        head={["מועד", "סוג", "תאריך", "אחראים", "מצב", "מקור"]}
        rows={s.deadlines.map((d) => [d.title, d.type, d.due, d.assignees, d.state, d.source])}
      />
    ) : (
      empty
    );
  }
  if (part === "tasks") {
    return s.tasks.length > 0 ? (
      <Table head={["משימה", "מועד", "אחראים", "מצב"]} rows={s.tasks.map((t) => [t.title, t.due, t.assignees, t.state])} />
    ) : (
      empty
    );
  }
  return s.issues.length > 0 ? (
    <div className="space-y-3">
      {s.issues.map((i, n) => (
        <div key={n} className="print-keep rounded-control border border-line p-3">
          <p className="text-body font-semibold break-words">
            <span className="text-accent">{i.category}</span> · {i.title}
          </p>
          <p className="mt-1 text-body break-words">{i.explanation}</p>
          {i.source && <p className="mt-1 text-small text-muted break-words">מקור: {i.source}</p>}
          {i.question && (
            <p className="mt-1 text-body break-words">
              <span className="font-semibold">שאלת הבהרה מוצעת:</span> {i.question}
            </p>
          )}
        </div>
      ))}
    </div>
  ) : (
    empty
  );
}
