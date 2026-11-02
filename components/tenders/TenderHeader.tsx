"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/db/client";
import { LIST_LABELS, STATUSES, listForStatus, listHref, type TenderList } from "@/lib/tenders";
import { deleteTender } from "@/lib/tenders-storage";
import type { Tender, TenderStatus } from "@/lib/types";
import { DepartmentTag } from "./Tags";

const MOVED_MESSAGES: Record<TenderList, string> = {
  active: "המכרז הועבר למכרזים פעילים",
  archive: "המכרז הועבר לארכיון",
  submitted: "המכרז הועבר להוגשו",
};

export function TenderHeader({ tender, from }: { tender: Tender; from: TenderList }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<TenderStatus>(tender.status);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function changeStatus(next: TenderStatus) {
    const previous = status;
    setStatus(next);
    setSaving(true);
    const { error } = await createClient().from("tenders").update({ status: next }).eq("id", tender.id);
    setSaving(false);
    if (error) {
      setStatus(previous);
      toast("שינוי הסטטוס לא נשמר. אפשר לנסות שוב.", "error");
      return;
    }
    const list = listForStatus(next);
    toast(list !== listForStatus(previous) ? MOVED_MESSAGES[list] : "נשמר");
    router.refresh();
  }

  return (
    <div className="mb-4">
      <Breadcrumb href={listHref(from, tender)} label={LIST_LABELS[from]} current={tender.name} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 text-h1 break-words">{tender.name}</h1>
          <DepartmentTag department={tender.department} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 md:w-[180px] md:flex-none">
            <label htmlFor="tender-status" className="sr-only">
              סטטוס
            </label>
            <Select
              id="tender-status"
              value={status}
              disabled={saving}
              onChange={(e) => changeStatus(e.target.value as TenderStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <MoreMenu onDelete={() => setDeleteOpen(true)} />
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`למחוק את "${tender.name}"?`}
        description="יימחקו גם כל הניתוח, המשימות, התזכורות והקבצים. אי אפשר לבטל את הפעולה."
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          const ok = await deleteTender(tender.id);
          if (ok) {
            toast("המכרז נמחק");
            router.push(listHref(from, tender));
            router.refresh();
          }
          return ok;
        }}
      />
    </div>
  );
}

// "⋯" button with a small menu; closes on Esc or an outside click and returns focus to the button
function MoreMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    itemRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="פעולות נוספות"
        title="פעולות נוספות"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex size-11 items-center justify-center rounded-control border border-text bg-white text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text md:size-[38px]"
      >
        <MoreHorizontal size={18} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-20 mt-1 min-w-[160px] rounded-control border border-line bg-white py-1 shadow-dialog motion-safe:animate-fade-in"
        >
          <button
            ref={itemRef}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex h-11 w-full items-center gap-2 px-3 text-start text-[14px] font-medium text-accent hover:bg-accent-tint focus-visible:bg-accent-tint focus-visible:outline-none md:h-9"
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            מחיקת מכרז
          </button>
        </div>
      )}
    </div>
  );
}
