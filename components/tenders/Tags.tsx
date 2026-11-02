import { departmentLabel, statusLabel } from "@/lib/tenders";
import type { Department, TenderStatus } from "@/lib/types";

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
