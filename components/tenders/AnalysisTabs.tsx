// Read-only views of the AI analysis (M3); editing comes in M4
import { CopyButton } from "@/components/tenders/CopyButton";
import { CategoryTag } from "@/components/tenders/Tags";
import { DEADLINE_TYPE_LABELS, formatDue, formatSourceRef } from "@/lib/analysis";
import type { Deadline, Issue, Requirement, SourceRef, Task } from "@/lib/types";

const thClass = "px-4 py-2.5 text-start font-medium";
const tdClass = "px-4 py-2.5 align-top";

function Heading({ children }: { children: string }) {
  return (
    <h2 id="tab-heading" className="mb-3 text-h3">
      {children}
    </h2>
  );
}

export function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-card border border-line bg-white px-6 py-10 text-center shadow-card">
      <p className="text-body text-muted">{text}</p>
    </div>
  );
}

// File names may be Hebrew or Latin, so each reference is isolated from the RTL text around it
function Sources({ refs }: { refs: SourceRef[] }) {
  return (
    <>
      {refs.map((r, i) => (
        <span key={i}>
          {i > 0 && " / "}
          <bdi>{formatSourceRef(r)}</bdi>
        </span>
      ))}
    </>
  );
}

function Due({ iso, hasTime }: { iso: string; hasTime: boolean }) {
  return (
    <>
      <span dir="ltr" className="whitespace-nowrap">
        {formatDue(iso, hasTime)}
      </span>
      {!hasTime && <span className="ms-2 text-small text-muted">שעה לא צוינה</span>}
    </>
  );
}

export function RequirementsTab({ items }: { items: Requirement[] }) {
  return (
    <section aria-labelledby="tab-heading">
      <Heading>סיכום דרישות המכרז</Heading>
      {items.length === 0 ? (
        <EmptyCard text="לא נמצאו דרישות במסמכי המכרז." />
      ) : (
        <ul className="list-disc space-y-2 rounded-card border border-line bg-white py-5 ps-10 pe-6 shadow-card marker:text-muted">
          {items.map((r) => (
            <li key={r.id}>{r.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function deadlineSource(d: Deadline) {
  if (d.is_auto) return "אוטומטי (3 ימי עבודה לפני ההגשה)";
  if (d.is_manual) return "ידני";
  return d.source_refs.length > 0 ? <Sources refs={d.source_refs} /> : "—";
}

export function TimelineTab({ items }: { items: Deadline[] }) {
  return (
    <section aria-labelledby="tab-heading">
      <Heading>מועדי המכרז</Heading>
      {items.length === 0 ? (
        <EmptyCard text="לא נמצאו מועדים במסמכי המכרז." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-table border border-line bg-white md:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className={thClass}>מועד</th>
                  <th scope="col" className={thClass}>סוג</th>
                  <th scope="col" className={thClass}>תאריך ושעה</th>
                  <th scope="col" className={thClass}>מקור</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-b-0">
                    <td className={`${tdClass} min-w-36 font-medium`}>{d.title}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{DEADLINE_TYPE_LABELS[d.type]}</td>
                    <td className={tdClass}>
                      <Due iso={d.due_at} hasTime={d.has_time} />
                    </td>
                    <td className={`${tdClass} w-2/5 text-small text-muted`}>{deadlineSource(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((d) => (
              <li key={d.id} className="rounded-card border border-line bg-white p-4 shadow-card">
                <p className="text-h3">{d.title}</p>
                <dl className="mt-1 space-y-0.5 text-body">
                  <div className="flex gap-1">
                    <dt className="text-muted">סוג:</dt>
                    <dd>{DEADLINE_TYPE_LABELS[d.type]}</dd>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <dt className="text-muted">מועד:</dt>
                    <dd>
                      <Due iso={d.due_at} hasTime={d.has_time} />
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="shrink-0 text-muted">מקור:</dt>
                    <dd className="min-w-0 break-words text-small text-muted">{deadlineSource(d)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function TasksTab({ items }: { items: Task[] }) {
  const due = (t: Task) => (t.due_at ? <Due iso={t.due_at} hasTime={t.has_time} /> : <span className="text-muted">—</span>);
  return (
    <section aria-labelledby="tab-heading">
      <Heading>משימות</Heading>
      {items.length === 0 ? (
        <EmptyCard text="לא נמצאו משימות." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-table border border-line bg-white md:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className={thClass}>משימה</th>
                  <th scope="col" className={thClass}>מועד</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-b-0">
                    <td className={tdClass}>{t.title}</td>
                    <td className={`${tdClass} w-64`}>{due(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((t) => (
              <li key={t.id} className="rounded-card border border-line bg-white p-4 shadow-card">
                <p className="font-medium">{t.title}</p>
                <p className="mt-1 text-body">
                  <span className="text-muted">מועד: </span>
                  {due(t)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function IssuesTab({ items }: { items: Issue[] }) {
  return (
    <section aria-labelledby="tab-heading">
      <Heading>סעיפים בעייתיים</Heading>
      {items.length === 0 ? (
        <EmptyCard text="לא נמצאו סעיפים בעייתיים." />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((issue) => (
            <li key={issue.id} className="rounded-card border border-line bg-white p-4 shadow-card md:p-5">
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryTag category={issue.category} />
                  <h3 className="font-semibold">{issue.title}</h3>
                </div>
                {issue.source_refs.length > 0 && (
                  <p className="text-small text-muted md:max-w-[45%] md:text-end">
                    <Sources refs={issue.source_refs} />
                  </p>
                )}
              </div>
              {issue.explanation && <p className="mt-2 text-body text-muted">{issue.explanation}</p>}
              {issue.suggested_question && (
                <div className="mt-3 flex flex-col gap-2 rounded-control bg-surface p-3 md:flex-row md:items-start md:justify-between">
                  <p className="text-body">
                    <span className="font-medium">שאלת הבהרה מוצעת: </span>
                    {issue.suggested_question}
                  </p>
                  <CopyButton text={issue.suggested_question} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
