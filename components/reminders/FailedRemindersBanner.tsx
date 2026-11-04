"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { CardField, tdClass, thClass } from "@/components/tenders/ListParts";
import { createClient } from "@/lib/db/client";
import type { FailedReminder } from "@/lib/types";

// "● 2 תזכורות לא נשלחו" bar on the dashboard and the active tenders, with a details dialog
export function FailedRemindersBanner({ items }: { items: FailedReminder[] }) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [handled, setHandled] = useState<string[]>([]);
  const router = useRouter();
  const toast = useToast();

  const visible = items.filter((r) => !handled.includes(r.id));
  if (visible.length === 0 && !open) return null;

  async function markHandled(id: string) {
    setBusyId(id);
    const { error } = await createClient()
      .from("reminders")
      .update({ handled_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast("השמירה לא הצליחה. אפשר לנסות שוב.", "error");
      return;
    }
    setHandled((h) => [...h, id]);
    toast("נשמר");
    router.refresh();
  }

  const count = visible.length;
  const text = count === 1 ? "תזכורת אחת לא נשלחה" : `${count} תזכורות לא נשלחו`;

  return (
    <>
      {count > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-control bg-accent-tint px-4 py-2.5 text-body text-accent">
          <p className="font-medium">● {text}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-my-2 inline-flex min-h-11 items-center font-medium underline underline-offset-2 hover:text-accent-dark focus-visible:outline-2 focus-visible:outline-text md:min-h-0"
          >
            פרטים
          </button>
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="תזכורות שלא נשלחו" wide>
        {count === 0 ? (
          <p className="pb-4 text-body text-muted">כל התזכורות שלא נשלחו סומנו כטופלו.</p>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-table border border-line md:block">
              <table className="w-full">
                <thead className="bg-table-head">
                  <tr className="border-b border-line text-small text-muted">
                    <th scope="col" className={thClass}>מכרז</th>
                    <th scope="col" className={thClass}>משימה</th>
                    <th scope="col" className={thClass}>נמען</th>
                    <th scope="col" className={thClass}>סיבה</th>
                    <th scope="col" className={thClass}><span className="sr-only">פעולות</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-b-0">
                      <td className={tdClass}>{r.tender_name}</td>
                      <td className={tdClass}>{r.task_title}</td>
                      <td className={tdClass}>
                        <span dir="ltr" className="break-all">{r.recipient_email ?? "—"}</span>
                      </td>
                      <td className={tdClass}>{r.error ?? "תקלה בשליחה"}</td>
                      <td className={tdClass}>
                        <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => markHandled(r.id)}>
                          סימון כטופל
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: one card per reminder */}
            <ul className="flex flex-col gap-2 md:hidden">
              {visible.map((r) => (
                <li key={r.id} className="rounded-card border border-line bg-white p-4">
                  <p className="text-h3">{r.task_title}</p>
                  <dl className="mt-2 flex flex-col gap-1.5 text-body">
                    <CardField label="מכרז">{r.tender_name}</CardField>
                    <CardField label="נמען">
                      <span dir="ltr" className="break-all">{r.recipient_email ?? "—"}</span>
                    </CardField>
                    <CardField label="סיבה">{r.error ?? "תקלה בשליחה"}</CardField>
                  </dl>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3 w-full"
                    disabled={busyId === r.id}
                    onClick={() => markHandled(r.id)}
                  >
                    סימון כטופל
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="pt-3 pb-4 text-small text-muted">על כל תזכורת שנכשלה נשלח אלייך גם מייל.</p>
      </Dialog>
    </>
  );
}
