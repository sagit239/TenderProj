import { isOverdue } from "@/lib/analysis";
import { ACTIVE_STATUSES, SUBMITTED_STATUSES, earliestSubmission } from "@/lib/tenders";
import type { TenderStatus } from "@/lib/types";

// All the dashboard numbers (PRD F15), calculated from one list of tenders

export type DashboardTender = {
  status: TenderStatus;
  submitted_at: string | null;
  deadlines: { due_at: string }[];
  tasks: { due_at: string | null; is_done: boolean }[];
};

export type MonthCount = { key: string; label: string; count: number };

export type Dashboard = {
  isEmpty: boolean;
  openSubmissions: number;
  overdueTasks: number;
  weekTasks: number;
  statusCounts: Record<TenderStatus, number>;
  upcoming: MonthCount[];
  submitted: MonthCount[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const monthParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
});

// The calendar month of a moment in Israel time, so the 1st at 00:30 is not counted in the month before
function israelMonth(time: Date | string | number) {
  const parts = monthParts.formatToParts(new Date(time));
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: value("year"), month: value("month") };
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

// "נוב׳ 26"; the date is built in UTC, so it is formatted in UTC
const monthLabel = new Intl.DateTimeFormat("he-IL", { timeZone: "UTC", month: "short", year: "2-digit" });

// count months from the current month plus firstOffset, each with zero submissions
function monthRange(now: number, firstOffset: number, count: number): MonthCount[] {
  const { year, month } = israelMonth(now);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 + firstOffset + i, 1));
    return {
      key: monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1),
      label: monthLabel.format(date),
      count: 0,
    };
  });
}

// Dates outside the range are not shown
function addToMonth(months: MonthCount[], iso: string) {
  const { year, month } = israelMonth(iso);
  const found = months.find((m) => m.key === monthKey(year, month));
  if (found) found.count += 1;
}

export function buildDashboard(tenders: DashboardTender[], now: number): Dashboard {
  const statusCounts: Record<TenderStatus, number> = {
    reviewing: 0,
    preparing: 0,
    not_bidding: 0,
    submitted: 0,
    won: 0,
    lost: 0,
  };
  const upcoming = monthRange(now, 0, 6);
  const submitted = monthRange(now, -11, 12);
  let overdueTasks = 0;
  let weekTasks = 0;

  for (const tender of tenders) {
    statusCounts[tender.status] += 1;

    if (ACTIVE_STATUSES.includes(tender.status)) {
      overdueTasks += tender.tasks.filter((t) => isOverdue(t, now)).length;
      weekTasks += tender.tasks.filter((t) => {
        if (t.is_done || t.due_at === null) return false;
        const due = new Date(t.due_at).getTime();
        return due >= now && due < now + WEEK_MS;
      }).length;
      const submission = earliestSubmission(tender.deadlines);
      if (submission) addToMonth(upcoming, submission.due_at);
    }

    // A tender that went back to the active list keeps submitted_at (ADR-14), so the status decides too
    if (SUBMITTED_STATUSES.includes(tender.status) && tender.submitted_at) {
      addToMonth(submitted, tender.submitted_at);
    }
  }

  return {
    isEmpty: tenders.length === 0,
    openSubmissions: statusCounts.reviewing + statusCounts.preparing,
    overdueTasks,
    weekTasks,
    statusCounts,
    upcoming,
    submitted,
  };
}
