import type { Metadata } from "next";
import Link from "next/link";
import { CardField, DepartmentPills, EmptyState, LoadError, ShowAllLink, tdClass, thClass } from "@/components/tenders/ListParts";
import { DepartmentTag } from "@/components/tenders/Tags";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/db/server";
import { ARCHIVE_STATUSES, formatDate, isDepartment, tenderHref } from "@/lib/tenders";
import type { Tender } from "@/lib/types";

export const metadata: Metadata = { title: "ארכיון · ניהול מכרזים" };

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { dept } = await searchParams;
  const department = isDepartment(dept) ? dept : null;

  const supabase = await createClient();
  let query = supabase
    .from("tenders")
    .select("id, name, department, status, decided_at, submitted_at, created_at")
    .in("status", ARCHIVE_STATUSES)
    .order("decided_at", { ascending: false, nullsFirst: false });
  if (department) query = query.eq("department", department);
  const { data, error } = await query;
  const tenders = (data ?? []) as Tender[];

  const viewLink = (t: Tender, extra = "") => (
    <Link
      href={tenderHref(t.id, "archive")}
      aria-label={`צפייה ב${t.name}`}
      className={`${buttonClasses("secondary", "sm")} ${extra}`}
    >
      צפייה
    </Link>
  );

  return (
    <>
      <PageHeader title="ארכיון" subtitle="מכרזים שהוחלט לא לגשת אליהם" />
      <DepartmentPills basePath="/archive" active={department} />

      {error && <LoadError retryHref={department ? `/archive?dept=${department}` : "/archive"} />}

      {!error && tenders.length === 0 &&
        (department ? (
          <EmptyState text="אין מכרזים בארכיון במחלקה הזו." action={<ShowAllLink href="/archive" />} />
        ) : (
          <EmptyState text="אין מכרזים בארכיון." />
        ))}

      {tenders.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-table border border-line bg-white md:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className={thClass}>שם המכרז</th>
                  <th scope="col" className={thClass}>מחלקה</th>
                  <th scope="col" className={thClass}>תאריך החלטה</th>
                  <th scope="col" className={thClass}>
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-b-0">
                    <td className={`${tdClass} font-medium`}>{t.name}</td>
                    <td className={tdClass}>
                      <DepartmentTag department={t.department} />
                    </td>
                    <td className={tdClass}>
                      <span dir="ltr">{formatDate(t.decided_at)}</span>
                    </td>
                    <td className="px-4 py-1.5 text-end">{viewLink(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {tenders.map((t) => (
              <li key={t.id} className="rounded-card border border-line bg-white p-4 shadow-card">
                <p className="text-h3">{t.name}</p>
                <dl className="mt-2 flex flex-col gap-1.5 text-body">
                  <CardField label="מחלקה">
                    <DepartmentTag department={t.department} />
                  </CardField>
                  <CardField label="תאריך החלטה">
                    <span dir="ltr">{formatDate(t.decided_at)}</span>
                  </CardField>
                </dl>
                {viewLink(t, "mt-3 w-full")}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
