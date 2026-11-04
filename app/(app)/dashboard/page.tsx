import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MonthBars } from "@/components/dashboard/MonthBars";
import { StatCard } from "@/components/dashboard/StatCard";
import { FailedRemindersBanner } from "@/components/reminders/FailedRemindersBanner";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { LoadError } from "@/components/tenders/ListParts";
import { StatusBadge } from "@/components/tenders/Tags";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildDashboard, type DashboardTender } from "@/lib/dashboard";
import { createClient } from "@/lib/db/server";
import { loadFailedReminders } from "@/lib/failed-reminders";
import type { TenderStatus } from "@/lib/types";

export const metadata: Metadata = { title: "לוח בקרה · ניהול מכרזים" };

// "לא ניגשים" is not one of the dashboard's measures (F15)
const STATUS_CARDS: { status: TenderStatus; href: string }[] = [
  { status: "reviewing", href: "/tenders" },
  { status: "preparing", href: "/tenders" },
  { status: "submitted", href: "/submitted" },
  { status: "won", href: "/submitted" },
  { status: "lost", href: "/submitted" },
];

function NewTenderLink({ variant }: { variant: "accent" | "primary" }) {
  return (
    <Link href="/tenders/new" className={buttonClasses(variant)}>
      <Plus size={16} strokeWidth={2} aria-hidden />
      מכרז חדש
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data, error }, failed] = await Promise.all([
    supabase
      .from("tenders")
      .select("status, submitted_at, deadlines(due_at), tasks(due_at, is_done)")
      .eq("deadlines.type", "submission"),
    loadFailedReminders(supabase),
  ]);
  const dashboard = buildDashboard((data ?? []) as DashboardTender[], new Date().getTime());

  const measures = [
    { label: "הגשות פתוחות", value: dashboard.openSubmissions, href: "/tenders" },
    { label: "משימות באיחור", value: dashboard.overdueTasks, href: "/tenders", alert: dashboard.overdueTasks > 0 },
    { label: "משימות בשבוע הקרוב", value: dashboard.weekTasks },
  ];

  return (
    <>
      <PageHeader title="לוח בקרה" />
      <FailedRemindersBanner items={failed} />

      <nav aria-label="מעבר מהיר" className="mb-6 flex flex-wrap gap-2">
        <NewTenderLink variant="accent" />
        {NAV_ITEMS.filter((item) => item.href !== "/dashboard").map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={buttonClasses("secondary")}>
            <Icon size={16} strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      {/* No measures after a failed load: a zero would look like real data */}
      {error ? (
        <LoadError retryHref="/dashboard" />
      ) : (
        <>
          {dashboard.isEmpty && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3 shadow-card">
              <p className="text-body text-muted">עדיין אין מכרזים.</p>
              <NewTenderLink variant="primary" />
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {measures.map(({ label, value, href, alert }) => (
              <StatCard key={label} href={href}>
                <p className={`text-display ${alert ? "text-accent" : "text-text"}`}>{value}</p>
                <p className="text-small text-muted">{label}</p>
              </StatCard>
            ))}
          </div>

          <h2 className="mb-3 text-h2 text-text">מכרזים לפי סטטוס</h2>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {STATUS_CARDS.map(({ status, href }) => (
              <StatCard key={status} href={href}>
                <p className="mb-1 text-h1 text-text">{dashboard.statusCounts[status]}</p>
                <StatusBadge status={status} />
              </StatCard>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <MonthBars title="הגשות בחודשים הקרובים" months={dashboard.upcoming} />
            <MonthBars title="הגשות שבוצעו בשנה האחרונה" months={dashboard.submitted} />
          </div>
        </>
      )}
    </>
  );
}
