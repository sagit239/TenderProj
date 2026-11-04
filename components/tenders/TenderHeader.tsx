"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Mail, MoreHorizontal, Printer, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { buttonClasses } from "@/components/ui/Button";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { Select } from "@/components/ui/Field";
import { MenuButton } from "@/components/ui/MenuButton";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/db/client";
import { LIST_LABELS, STATUSES, listForStatus, listHref, type TenderList } from "@/lib/tenders";
import { deleteTender } from "@/lib/tenders-storage";
import type { Tender, TenderStatus } from "@/lib/types";
import { EmailDialog } from "./EmailDialog";
import { DepartmentTag } from "./Tags";

const MOVED_MESSAGES: Record<TenderList, string> = {
  active: "המכרז הועבר למכרזים פעילים",
  archive: "המכרז הועבר לארכיון",
  submitted: "המכרז הועבר להוגשו",
};

const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-text bg-white text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text md:size-[38px]";

export function TenderHeader({ tender, from }: { tender: Tender; from: TenderList }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<TenderStatus>(tender.status);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

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

  // Fetches the file first, so a failure shows a message instead of an error page
  async function downloadWord() {
    try {
      const res = await fetch(`/api/tenders/${tender.id}/export/docx`);
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${tender.name.replace(/[\/:*?"<>|]+/g, "-").trim() || "מכרז"}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("הקובץ לא נוצר. אפשר לנסות שוב.", "error");
    }
  }

  return (
    <div className="mb-4">
      <Breadcrumb href={listHref(from, tender)} label={LIST_LABELS[from]} current={tender.name} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 text-h1 break-words">{tender.name}</h1>
          <DepartmentTag department={tender.department} />
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="md:w-[180px]">
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
          {/* On mobile: export and email on their own row (DESIGN: התאמה לנייד) */}
          <div className="flex items-center gap-2">
            <MenuButton
              className="flex-1 md:flex-none"
              buttonClassName={`${buttonClasses("secondary")} w-full`}
              items={[
                { label: "Word", icon: <FileText size={16} strokeWidth={1.75} aria-hidden />, onSelect: downloadWord },
                {
                  label: "PDF (הדפסה)",
                  icon: <Printer size={16} strokeWidth={1.75} aria-hidden />,
                  onSelect: () => window.open(`/print/tenders/${tender.id}?auto=1`, "_blank"),
                },
              ]}
            >
              ייצוא
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
            </MenuButton>
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              className={`${buttonClasses("secondary")} flex-1 md:flex-none`}
            >
              <Mail size={16} strokeWidth={1.75} aria-hidden />
              שליחה במייל
            </button>
            <MenuButton
              label="פעולות נוספות"
              buttonClassName={iconButton}
              items={[
                {
                  label: "מחיקת מכרז",
                  icon: <Trash2 size={16} strokeWidth={1.75} aria-hidden />,
                  danger: true,
                  onSelect: () => setDeleteOpen(true),
                },
              ]}
            >
              <MoreHorizontal size={18} strokeWidth={1.75} />
            </MenuButton>
          </div>
        </div>
      </div>

      <EmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} tender={tender} />
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
