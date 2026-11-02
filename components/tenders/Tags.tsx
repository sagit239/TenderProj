import { ISSUE_CATEGORY_LABELS } from "@/lib/analysis";
import { departmentLabel, statusLabel } from "@/lib/tenders";
import type { Department, DocumentReadState, IssueCategory, TenderStatus } from "@/lib/types";

// "רפואי" on Charcoal, "בטיחות" on Slate; red stays for what needs attention
export function DepartmentTag({ department }: { department: Department }) {
  return (
    <span
      className={[
        "inline-flex h-[22px] items-center rounded-tag px-2 text-small whitespace-nowrap text-white",
        department === "medical" ? "bg-charcoal" : "bg-slate",
      ].join(" ")}
    >
      {departmentLabel(department)}
    </span>
  );
}

const STATUS_STYLES: Record<TenderStatus, string> = {
  reviewing: "bg-line/70 text-text",
  preparing: "border border-input-border bg-surface text-text",
  submitted: "border border-input-border bg-surface text-text",
  not_bidding: "bg-line/70 text-muted",
  lost: "bg-line/70 text-muted",
  won: "border border-[#9a9aa0] bg-gradient-to-l from-[#f2f2f3] to-[#c4c4c8] text-text font-semibold",
};

export function StatusBadge({ status }: { status: TenderStatus }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-small whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {status === "won" && <span aria-hidden>★&nbsp;</span>}
      {statusLabel(status)}
    </span>
  );
}

// Issue category: red on Red Tint, 4px corners
export function CategoryTag({ category }: { category: IssueCategory }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-tag bg-accent-tint px-2 text-small whitespace-nowrap text-accent">
      {ISSUE_CATEGORY_LABELS[category]}
    </span>
  );
}

// How well the AI could read a file; "—" before the first analysis
export function ReadBadge({ doc }: { doc: DocumentReadState }) {
  if (!doc.analyzed_at) return <span className="text-muted">—</span>;
  const [label, style] =
    doc.read_warning === "unreadable"
      ? ["לא נקרא", "bg-accent-tint text-accent"]
      : doc.read_warning === "partial"
        ? ["נקרא חלקית", "bg-warning/10 text-warning"]
        : ["נקרא", "bg-done/10 text-done"];
  return (
    <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-small whitespace-nowrap ${style}`}>
      {label}
    </span>
  );
}
