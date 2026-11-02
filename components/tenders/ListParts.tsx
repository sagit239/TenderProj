import Link from "next/link";
import type { ReactNode } from "react";
import { FilterPills } from "@/components/ui/FilterPills";
import { DEPARTMENTS } from "@/lib/tenders";
import type { Department } from "@/lib/types";

// "הכול / רפואי / בטיחות" pills for a list page
export function DepartmentPills({ basePath, active }: { basePath: string; active: Department | null }) {
  return (
    <FilterPills
      label="סינון לפי מחלקה"
      active={active ?? "all"}
      pills={[
        { key: "all", label: "הכול", href: basePath },
        ...DEPARTMENTS.map((d) => ({ key: d.key, label: d.label, href: `${basePath}?dept=${d.key}` })),
      ]}
    />
  );
}

export function LoadError({ retryHref }: { retryHref: string }) {
  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-control bg-accent-tint px-4 py-2.5 text-accent"
    >
      <span>לא הצלחנו לטעון את המכרזים.</span>
      <a href={retryHref} className="font-semibold underline">
        ניסיון חוזר
      </a>
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-white px-6 py-12 text-center shadow-card">
      <p className={`text-body text-muted ${action ? "mb-4" : ""}`}>{text}</p>
      {action}
    </div>
  );
}

export function ShowAllLink({ href }: { href: string }) {
  return (
    <Link href={href} className="font-semibold text-text underline">
      הצגת הכול
    </Link>
  );
}

export const thClass = "px-4 py-2.5 text-start font-medium";
export const tdClass = "px-4 py-2.5";

// One label/value line inside a mobile card
export function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <dt className="text-muted">{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}
