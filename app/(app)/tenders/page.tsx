import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CardField, DepartmentPills, EmptyState, LoadError, ShowAllLink, tdClass, thClass } from "@/components/tenders/ListParts";
import { DepartmentTag, StatusBadge } from "@/components/tenders/Tags";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDue } from "@/lib/analysis";
import { createClient } from "@/lib/db/server";
import { ACTIVE_STATUSES, isDepartment, tenderHref } from "@/lib/tenders";
import type { Tender } from "@/lib/types";

type Submission = { due_at: string; has_time: boolean };
type TenderRow = Tender & { deadlines: Submission[] };

// The earliest submission deadline decides (contradicting dates are flagged as an issue)
function submissionDate(t: TenderRow) {
  const first = [...t.deadlines].sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
  return first ? formatDue(first.due_at, first.has_time) : null;
}

export const metadata: Metadata = { title: "מכרזים פעילים · ניהול מכרזים" };

export default async function ActiveTendersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { dept } = await searchParams;
  const department = isDepartment(dept) ? dept : null;

  const supabase = await createClient();
  let query = supabase
    .from("tenders")
    .select("id, name, department, status, decided_at, submitted_at, created_at, deadlines(due_at, has_time)")
    .eq("deadlines.type", "submission")
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false });
  if (department) query = query.eq("department", department);
  const { data, error } = await query;
  const tenders = (data ?? []) as TenderRow[];

  const newButton = (
    <Link href="/tenders/new" className={buttonClasses("primary")}>
      <Plus size={16} strokeWidth={2} aria-hidden />
      מכרז חדש
    </Link>
  );

  return (
    <>
      <PageHeader title="מכרזים פעילים" action={newButton} />
      <DepartmentPills basePath="/tenders" active={department} />

      {error && <LoadError retryHref={department ? `/tenders?dept=${department}` : "/tenders"} />}

      {!error && tenders.length === 0 &&
        (department ? (
          <EmptyState text="אין מכרזים פעילים במחלקה הזו." action={<ShowAllLink href="/tenders" />} />
        ) : (
          <EmptyState text="עדיין אין מכרזים פעילים." action={newButton} />
        ))}

      {tenders.length > 0 && (
        <>
          {/* Desktop: table; the whole row opens the tender (stretched link on the name) */}
          <div className="hidden overflow-hidden rounded-table border border-line bg-white md:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className={thClass}>שם המכרז</th>
                  <th scope="col" className={thClass}>מחלקה</th>
                  <th scope="col" className={thClass}>סטטוס</th>
                  <th scope="col" className={thClass}>מועד הגשה</th>
                  <th scope="col" className={thClass}>משימות פתוחות</th>
                  <th scope="col" className={thClass}>
                    <span className="sr-only">איחורים</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((t) => (
                  <tr
                    key={t.id}
                    className="relative border-b border-line transition-colors duration-150 last:border-b-0 hover:bg-surface"
                  >
                    <td className={`${tdClass} font-medium`}>
                      <Link
                        href={tenderHref(t.id, "active")}
                        className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-text"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className={tdClass}>
                      <DepartmentTag department={t.department} />
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={t.status} />
                    </td>
                    <td className={tdClass}>
                      {submissionDate(t) ? <span dir="ltr">{submissionDate(t)}</span> : <span className="text-muted">—</span>}
                    </td>
                    {/* Filled in by tasks (M4) */}
                    <td className={`${tdClass} text-muted`}>—</td>
                    <td className={tdClass} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per tender */}
          <ul className="flex flex-col gap-2 md:hidden">
            {tenders.map((t) => (
              <li key={t.id}>
                <Link
                  href={tenderHref(t.id, "active")}
                  className="block rounded-card border border-line bg-white p-4 shadow-card focus-visible:outline-2 focus-visible:outline-text"
                >
                  <p className="text-h3">{t.name}</p>
                  <dl className="mt-2 flex flex-col gap-1.5 text-body">
                    <CardField label="מחלקה">
                      <DepartmentTag department={t.department} />
                    </CardField>
                    <CardField label="סטטוס">
                      <StatusBadge status={t.status} />
                    </CardField>
                    {submissionDate(t) && (
                      <CardField label="מועד הגשה">
                        <span dir="ltr">{submissionDate(t)}</span>
                      </CardField>
                    )}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
