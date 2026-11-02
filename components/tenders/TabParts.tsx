"use client";

// Building blocks shared by the tender tabs (requirements, timeline, tasks, issues)
import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDue, formatSourceRef } from "@/lib/analysis";
import type { SourceRef } from "@/lib/types";

export const thClass = "px-4 py-2.5 text-start font-medium";
export const tdClass = "px-4 py-2.5 align-top";

// Sub-heading of a tab, with an optional small action button on the other side
export function TabHeading({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 id="tab-heading" className="text-h3">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <Plus size={14} strokeWidth={2} aria-hidden />
      {label}
    </Button>
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
export function Sources({ refs }: { refs: SourceRef[] }) {
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

export function Due({ iso, hasTime, className = "" }: { iso: string; hasTime: boolean; className?: string }) {
  return (
    <>
      <span dir="ltr" className={`whitespace-nowrap ${className}`}>
        {formatDue(iso, hasTime)}
      </span>
      {!hasTime && <span className="ms-2 text-small whitespace-nowrap text-muted">שעה לא צוינה</span>}
    </>
  );
}

// "✎ עריכה · 🗑 מחיקה" in grey, like the team members screen
export function ItemActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <span className="inline-flex shrink-0 items-center text-muted">
      <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`עריכת ${name}`}>
        <Pencil size={14} strokeWidth={1.75} aria-hidden />
        עריכה
      </Button>
      <span aria-hidden>·</span>
      <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`מחיקת ${name}`}>
        <Trash2 size={14} strokeWidth={1.75} aria-hidden />
        מחיקה
      </Button>
    </span>
  );
}

// Icon-only edit/delete for table rows
export function IconActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  const cls =
    "inline-flex size-11 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-text md:size-9";
  return (
    <span className="inline-flex">
      <button type="button" onClick={onEdit} aria-label={`עריכת ${name}`} title="עריכה" className={cls}>
        <Pencil size={16} strokeWidth={1.75} />
      </button>
      <button type="button" onClick={onDelete} aria-label={`מחיקת ${name}`} title="מחיקה" className={cls}>
        <Trash2 size={16} strokeWidth={1.75} />
      </button>
    </span>
  );
}

type Result = { error: unknown } | PromiseLike<{ error: unknown }>;

// Runs a Supabase write from the browser, then refreshes the page and shows a toast.
// Returns true on success.
export function useSave() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const save = useCallback(
    async (write: () => Result, message = "נשמר") => {
      setBusy(true);
      const { error } = await write();
      setBusy(false);
      if (error) {
        toast("השמירה לא הצליחה. אפשר לנסות שוב.", "error");
        return false;
      }
      if (message) toast(message);
      router.refresh();
      return true;
    },
    [router, toast],
  );

  // For ConfirmDeleteDialog, which shows its own error message
  const remove = useCallback(
    async (write: () => Result, message: string) => {
      const { error } = await write();
      if (error) return false;
      toast(message);
      router.refresh();
      return true;
    },
    [router, toast],
  );

  return { save, remove, busy };
}
