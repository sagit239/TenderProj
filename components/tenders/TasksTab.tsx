"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { createClient } from "@/lib/db/client";
import { NEEDS_ASSIGNEE, isOverdue, reminderLabel } from "@/lib/analysis";
import type { Deadline, Task } from "@/lib/types";
import { AssigneePicker, type Member } from "./AssigneePicker";
import { DeadlineDialog } from "./DeadlineDialog";
import { TaskDialog, saveAssignees } from "./TaskDialog";
import { AddButton, Due, EmptyCard, IconActions, ItemActions, TabHeading, tdClass, thClass, useSave } from "./TabParts";
import { OverdueBadge } from "./Tags";

type Props = {
  tenderId: string;
  items: Task[];
  members: Member[];
  // Titles of the deadlines that tasks are linked to (for the delete confirmation)
  deadlines: Pick<Deadline, "id" | "title">[];
};

export function TasksTab({ tenderId, items, members, deadlines }: Props) {
  const { save, remove } = useSave();
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [adding, setAdding] = useState<Task | null>(null);
  // Local copies for instant feedback; the server copy arrives with the refresh
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [assignees, setAssignees] = useState<Record<string, string[]>>({});
  // Time of the page load; overdue is recalculated on every refresh
  const [now] = useState(() => Date.now());

  const doneOf = (t: Task) => done[t.id] ?? t.is_done;
  const assigneesOf = (t: Task) => assignees[t.id] ?? t.assignee_ids;

  async function toggleDone(t: Task, value: boolean) {
    setDone((d) => ({ ...d, [t.id]: value }));
    const ok = await save(
      () => createClient().from("tasks").update({ is_done: value }).eq("id", t.id),
      value ? "המשימה סומנה כבוצעה" : "המשימה חזרה להיות פתוחה",
    );
    if (!ok) setDone((d) => ({ ...d, [t.id]: !value }));
  }

  async function changeAssignees(t: Task, ids: string[]) {
    const before = assigneesOf(t);
    setAssignees((a) => ({ ...a, [t.id]: ids }));
    const ok = await save(() => saveAssignees(createClient(), t.id, before, ids));
    if (!ok) setAssignees((a) => ({ ...a, [t.id]: before }));
  }

  const linkedTitle = (t: Task) => deadlines.find((d) => d.id === t.deadline_id)?.title;

  const doneBox = (t: Task) => (
    <Checkbox
      checked={doneOf(t)}
      onChange={(e) => toggleDone(t, e.target.checked)}
      aria-label={`בוצע: ${t.title}`}
    />
  );
  const picker = (t: Task, id: string) => (
    <AssigneePicker
      id={id}
      label={`אחראים למשימה ${t.title}`}
      members={members}
      value={assigneesOf(t)}
      onChange={(ids) => changeAssignees(t, ids)}
    />
  );
  const dueCell = (t: Task, late: boolean) =>
    t.due_at ? (
      <Due iso={t.due_at} hasTime={t.has_time} className={late ? "font-semibold text-accent" : ""} />
    ) : (
      <span className="text-muted">—</span>
    );
  const reminder = (t: Task) => {
    const text = reminderLabel(t, assigneesOf(t).length > 0);
    return text ? (
      <span className={text === NEEDS_ASSIGNEE ? "text-muted" : ""}>{text}</span>
    ) : (
      <span className="text-muted">—</span>
    );
  };
  const addButton = (t: Task) => (
    <Button variant="ghost" size="sm" onClick={() => setAdding(t)} aria-label={`הוספה ללוח הזמנים: ${t.title}`}>
      <CalendarPlus size={14} strokeWidth={1.75} aria-hidden />
      הוספה ללוח הזמנים
    </Button>
  );

  return (
    <section aria-labelledby="tab-heading">
      <TabHeading action={<AddButton label="הוספת משימה" onClick={() => setEditing(null)} />}>משימות</TabHeading>
      {items.length === 0 ? (
        <EmptyCard text="אין משימות. אפשר להוסיף משימה." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-table border border-line bg-white xl:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className="w-14 px-3 py-2.5 text-start font-medium">בוצע</th>
                  <th scope="col" className={thClass}>משימה</th>
                  <th scope="col" className={`${thClass} w-44`}>אחראים</th>
                  <th scope="col" className={thClass}>מועד</th>
                  <th scope="col" className={thClass}>תזכורת</th>
                  <th scope="col" className="w-24 px-2 py-2.5">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const late = isOverdue({ due_at: t.due_at, is_done: doneOf(t) }, now);
                  return (
                    <tr
                      key={t.id}
                      id={`item-${t.id}`}
                      className={`scroll-mt-24 border-b border-line last:border-b-0 ${late ? "bg-accent-tint/60" : ""}`}
                    >
                      <td className="px-3 py-1.5 align-middle">{doneBox(t)}</td>
                      <td className={`${tdClass} align-middle`}>
                        <span className={doneOf(t) ? "text-muted line-through decoration-muted/60" : ""}>{t.title}</span>
                        {late && <OverdueBadge className="ms-2" />}
                      </td>
                      <td className="px-4 py-1.5 align-middle">{picker(t, `assignees-${t.id}`)}</td>
                      <td className={`${tdClass} align-middle`}>{dueCell(t, late)}</td>
                      <td className={`${tdClass} align-middle whitespace-nowrap`}>
                        <span dir="auto">{reminder(t)}</span>
                      </td>
                      <td className="px-2 py-1 text-end align-middle whitespace-nowrap">
                        {!t.deadline_id && addButton(t)}
                        <IconActions name={t.title} onEdit={() => setEditing(t)} onDelete={() => setDeleting(t)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 xl:hidden">
            {items.map((t) => {
              const late = isOverdue({ due_at: t.due_at, is_done: doneOf(t) }, now);
              return (
                <li
                  key={t.id}
                  id={`item-m-${t.id}`}
                  className={`rounded-card border border-line p-4 ps-2 shadow-card ${late ? "bg-accent-tint/60" : "bg-white"}`}
                >
                  <div className="flex items-start gap-1">
                    {doneBox(t)}
                    <div className="min-w-0 flex-1 pt-2.5">
                      <p className={`font-medium ${doneOf(t) ? "text-muted line-through decoration-muted/60" : ""}`}>{t.title}</p>
                      {late && <OverdueBadge className="mt-1" />}
                    </div>
                  </div>
                  <dl className="mt-2 flex flex-col gap-2 ps-2 text-body">
                    <div className="flex flex-col gap-1">
                      <dt className="text-muted">אחראים</dt>
                      <dd>{picker(t, `assignees-m-${t.id}`)}</dd>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <dt className="text-muted">מועד:</dt>
                      <dd>{dueCell(t, late)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted">תזכורת:</dt>
                      <dd dir="auto">{reminder(t)}</dd>
                    </div>
                  </dl>
                  <div className="mt-1 -ms-1 flex flex-wrap items-center">
                    <ItemActions name={t.title} onEdit={() => setEditing(t)} onDelete={() => setDeleting(t)} />
                    {!t.deadline_id && addButton(t)}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <DeadlineDialog
        open={adding !== null}
        tenderId={tenderId}
        deadline={null}
        fromTask={adding}
        onClose={() => setAdding(null)}
      />
      <TaskDialog
        open={editing !== undefined}
        tenderId={tenderId}
        task={editing ? { ...editing, assignee_ids: assigneesOf(editing) } : null}
        members={members}
        nextSortOrder={Math.max(0, ...items.map((t) => t.sort_order)) + 1}
        onClose={() => {
          // The dialog saved its own assignees; drop the local copy so the server copy shows
          if (editing) {
            const id = editing.id;
            setAssignees((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== id)));
          }
          setEditing(undefined);
        }}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={deleting ? `למחוק את "${deleting.title}"?` : ""}
        description={
          deleting && linkedTitle(deleting)
            ? `יימחק גם המועד "${linkedTitle(deleting)}" מלוח הזמנים. אי אפשר לבטל את הפעולה.`
            : "המשימה תימחק מהמכרז. אי אפשר לבטל את הפעולה."
        }
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return true;
          const ok = await remove(() => createClient().from("tasks").delete().eq("id", deleting.id), "המשימה נמחקה");
          if (ok) setDeleting(null);
          return ok;
        }}
      />
    </section>
  );
}
