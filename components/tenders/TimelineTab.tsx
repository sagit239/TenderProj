"use client";

import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { createClient } from "@/lib/db/client";
import { DEADLINE_TYPE_LABELS } from "@/lib/analysis";
import type { Deadline } from "@/lib/types";
import { DeadlineDialog } from "./DeadlineDialog";
import { AddButton, Due, EmptyCard, IconActions, ItemActions, Sources, TabHeading, tdClass, thClass, useSave } from "./TabParts";

// An edited deadline from the documents keeps its reference
function deadlineSource(d: Deadline) {
  if (d.is_auto && !d.is_manual) return "אוטומטי (3 ימי עבודה לפני ההגשה)";
  if (d.source_refs.length > 0) return <Sources refs={d.source_refs} />;
  return d.is_manual ? "ידני" : "—";
}

export function TimelineTab({ tenderId, items }: { tenderId: string; items: Deadline[] }) {
  const { remove } = useSave();
  // undefined = closed, null = adding, Deadline = editing
  const [editing, setEditing] = useState<Deadline | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Deadline | null>(null);

  return (
    <section aria-labelledby="tab-heading">
      <TabHeading action={<AddButton label="הוספת מועד" onClick={() => setEditing(null)} />}>מועדי המכרז</TabHeading>
      {items.length === 0 ? (
        <EmptyCard text="לא נמצאו מועדים במסמכי המכרז. אפשר להוסיף מועדים ידנית." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-table border border-line bg-white md:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className={thClass}>מועד</th>
                  <th scope="col" className={thClass}>סוג</th>
                  <th scope="col" className={thClass}>תאריך ושעה</th>
                  <th scope="col" className={thClass}>מקור</th>
                  <th scope="col" className="w-24 px-2 py-2.5">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} id={`item-${d.id}`} className="scroll-mt-24 border-b border-line last:border-b-0">
                    <td className={`${tdClass} min-w-36 font-medium`}>{d.title}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{DEADLINE_TYPE_LABELS[d.type]}</td>
                    <td className={tdClass}>
                      <Due iso={d.due_at} hasTime={d.has_time} />
                    </td>
                    <td className={`${tdClass} w-2/5 text-small text-muted`}>{deadlineSource(d)}</td>
                    <td className="px-2 py-1 text-end whitespace-nowrap">
                      <IconActions name={d.title} onEdit={() => setEditing(d)} onDelete={() => setDeleting(d)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((d) => (
              <li key={d.id} id={`item-m-${d.id}`} className="rounded-card border border-line bg-white p-4 shadow-card">
                <p className="text-h3">{d.title}</p>
                <dl className="mt-1 space-y-0.5 text-body">
                  <div className="flex gap-1">
                    <dt className="text-muted">סוג:</dt>
                    <dd>{DEADLINE_TYPE_LABELS[d.type]}</dd>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <dt className="text-muted">מועד:</dt>
                    <dd>
                      <Due iso={d.due_at} hasTime={d.has_time} />
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="shrink-0 text-muted">מקור:</dt>
                    <dd className="min-w-0 break-words text-small text-muted">{deadlineSource(d)}</dd>
                  </div>
                </dl>
                <div className="mt-2 -ms-3 flex">
                  <ItemActions name={d.title} onEdit={() => setEditing(d)} onDelete={() => setDeleting(d)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <DeadlineDialog open={editing !== undefined} tenderId={tenderId} deadline={editing ?? null} onClose={() => setEditing(undefined)} />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={deleting ? `למחוק את "${deleting.title}"?` : ""}
        description={
          deleting?.is_auto
            ? "תימחק גם המשימה המקושרת, והפגישה לא תיווצר שוב אוטומטית. אי אפשר לבטל את הפעולה."
            : "תימחק גם המשימה המקושרת למועד. אי אפשר לבטל את הפעולה."
        }
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return true;
          const ok = await remove(() => createClient().from("deadlines").delete().eq("id", deleting.id), "המועד נמחק");
          if (ok) setDeleting(null);
          return ok;
        }}
      />
    </section>
  );
}
