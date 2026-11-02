import type { Metadata } from "next";
import Link from "next/link";
import { CardField, EmptyState, LoadError, tdClass, thClass } from "@/components/tenders/ListParts";
import { StatusBadge } from "@/components/tenders/Tags";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { createClient } from "@/lib/db/server";
import { DEPARTMENTS, SUBMITTED_STATUSES, formatDate, isDepartment, tenderHref } from "@/lib/tenders";
import type { Tender } from "@/lib/types";

export const metadata: Metadata = { title: "הוגשו · ניהול מכרזים" };

export default async function SubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { dept } = await searchParams;
  const department = isDepartment(dept) ? dept : "medical";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenders")
    .select("id, name, department, status, decided_at, submitted_at, created_at")
    .in("status", SUBMITTED_STATUSES)
    .eq("department", department)
    .order("submitted_at", { ascending: false, nullsFirst: false });
  const tenders = (data ?? []) as Tender[];

  const viewLink = (t: Tender, extra = "") => (
    <Link
      href={tenderHref(t.id, "submitted")}
      aria-label={`צפייה ב${t.name}`}
      className={`${buttonClasses("secondary", "sm")} ${extra}`}
    >
      צפייה
    </Link>
  );

  // Won tenders stand out: ★ before a bold name, light gray row
  const nameCell = (t: Tender) =>
    t.status === "won" ? (
      <span className="font-bold">
        <span aria-hidden>★ </span>
        {t.name}
      </span>
    ) : (
      <span className="font-medium">{t.name}</span>
    );

  return (
    <>
      <PageHeader title="מכרזים שהוגשו" />
      <Tabs
        label="מחלקה"
        active={department}
        tabs={DEPARTMENTS.map((d) => ({ key: d.key, label: d.label, href: `/submitted?dept=${d.key}` }))}
      />

      {error && <LoadError retryHref={`/submitted?dept=${department}`} />}

      {!error && tenders.length === 0 && <EmptyState text="עדיין אין מכרזים שהוגשו במחלקה הזו." />}

      {tenders.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-table border border-line bg-white md:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className={thClass}>שם המכרז</th>
                  <th scope="col" className={thClass}>תאריך הגשה</th>
                  <th scope="col" className={thClass}>סטטוס</th>
                  <th scope="col" className={thClass}>
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-line last:border-b-0 ${t.status === "won" ? "bg-[#ededef]" : ""}`}
                  >
                    <td className={tdClass}>{nameCell(t)}</td>
                    <td className={tdClass}>
                      <span dir="ltr">{formatDate(t.submitted_at)}</span>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-1.5 text-end">{viewLink(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {tenders.map((t) => (
              <li
                key={t.id}
                className={`rounded-card border border-line p-4 shadow-card ${t.status === "won" ? "bg-[#ededef]" : "bg-white"}`}
              >
                <p className="text-h3">{nameCell(t)}</p>
                <dl className="mt-2 flex flex-col gap-1.5 text-body">
                  <CardField label="תאריך הגשה">
                    <span dir="ltr">{formatDate(t.submitted_at)}</span>
                  </CardField>
                  <CardField label="סטטוס">
                    <StatusBadge status={t.status} />
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
