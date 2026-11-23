"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/db/client";
import { NEEDS_ASSIGNEE, isOverdue, reminderLabel } from "@/lib/analysis";
import type { Deadline, Requirement, Task } from "@/lib/types";
import { AssigneePicker, type Member } from "./AssigneePicker";
import { DeadlineDialog } from "./DeadlineDialog";
import { ItemSource, itemSourceText } from "./ItemSource";
import { RevertAction } from "./RevertAction";
import { SortSelect, SortTh, useSort } from "./sorting";
import { TaskDialog } from "./TaskDialog";
import { AddButton, Due, EmptyCard, IconActions, ItemActions, TabHeading, tdClass, thClass, useSave } from "./TabParts";
import { DetailsText } from "./DetailsText";
import { OverdueBadge } from "./Tags";
import { useTaskEdits } from "./useTaskEdits";

type Props = {
  tenderId: string;
  items: Task[];
  members: Member[];
  // Titles of the deadlines that tasks are linked to (for the delete confirmation)
  deadlines: Pick<Deadline, "id" | "title">[];
  // For "דרישה קשורה" in the task dialog
  requirements: Pick<Requirement, "id" | "text">[];
};

export function TasksTab({ tenderId, items, members, deadlines, requirements }: Props) {
  const { remove } = useSave();
  const { doneOf, assigneesOf, toggleDone, changeAssignees, forgetAssignees } = useTaskEdits();
  const toast = useToast();
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [adding, setAdding] = useState<Task | null>(null);
  // Time of the page load; overdue is recalculated on every refresh
  const [now] = useState(() => Date.now());

  const { sorted, sorting } = useSort(items, [
    { key: "done", label: "בוצע", value: (t) => (doneOf(t) ? 1 : 0) },
    { key: "title", label: "משימה", value: (t) => t.title },
    {
      key: "assignees",
      label: "אחראים",
      value: (t) => members.find((m) => assigneesOf(t).includes(m.id))?.name ?? null,
    },
    { key: "due", label: "מועד", value: (t) => (t.due_at ? new Date(t.due_at).getTime() : null) },
    { key: "reminder", label: "תזכורת", value: (t) => reminderLabel(t, assigneesOf(t).length > 0) },
    { key: "source", label: "מקור", value: itemSourceText },
  ]);

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
          <SortSelect sorting={sorting} id="tasks-sort" />
          <div className="hidden overflow-hidden rounded-table border border-line bg-white xl:block">
            <table className="w-full table-fixed">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <SortTh sorting={sorting} column="done" className="w-16 px-3 py-2.5 text-start font-medium" />
                  <SortTh sorting={sorting} column="title" />
                  <SortTh sorting={sorting} column="assignees" className={`${thClass} w-40`} />
                  <SortTh sorting={sorting} column="due" className={`${thClass} w-36`} />
                  <SortTh sorting={sorting} column="reminder" className={`${thClass} w-28`} />
                  <SortTh sorting={sorting} column="source" className={`${thClass} w-52`} />
                  <th scope="col" className="w-32 px-2 py-2.5">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const late = isOverdue({ due_at: t.due_at, is_done: doneOf(t) }, now);
                  // A row with a details line is taller: every cell starts at the top
                  const va = t.details ? "!align-top" : "align-middle";
                  return (
                    <tr
                      key={t.id}
                      id={`item-${t.id}`}
                      className={`scroll-mt-24 border-b border-line last:border-b-0 ${late ? "bg-accent-tint/60" : ""}`}
                    >
                      <td className={`px-3 py-1.5 ${va}`}>{doneBox(t)}</td>
                      <td className={`${tdClass} ${va} [overflow-wrap:anywhere]`}>
                        <span className={doneOf(t) ? "text-muted line-through decoration-muted/60" : ""}>{t.title}</span>
                        {late && <OverdueBadge className="ms-2" />}
                        {t.details && <DetailsText text={t.details} className="mt-0.5 max-w-prose" />}
                        {!t.deadline_id && <div className="-ms-3">{addButton(t)}</div>}
                      </td>
                      <td className={`px-4 py-1.5 ${va}`}>{picker(t, `assignees-${t.id}`)}</td>
                      <td className={`${tdClass} ${va}`}>{dueCell(t, late)}</td>
                      <td className={`${tdClass} ${va}`}>
                        <span dir="auto">{reminder(t)}</span>
                      </td>
                      <td className={`${tdClass} ${va} text-small [overflow-wrap:anywhere] text-muted`}>
                        <ItemSource item={t} />
                      </td>
                      <td className={`px-2 py-1 text-end ${va} whitespace-nowrap`}>
                        <IconActions
                          name={t.title}
                          onEdit={() => setEditing(t)}
                          onDelete={() => setDeleting(t)}
                          revert={<RevertAction table="tasks" item={t} name={t.title} icon />}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 xl:hidden">
            {sorted.map((t) => {
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
                      {t.details && <DetailsText text={t.details} className="mt-1" />}
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
                    <div className="flex gap-1">
                      <dt className="shrink-0 text-muted">מקור:</dt>
                      <dd className="min-w-0 text-small [overflow-wrap:anywhere] text-muted">
                        <ItemSource item={t} />
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-1 -ms-1 flex flex-wrap items-center">
                    <ItemActions
                      name={t.title}
                      onEdit={() => setEditing(t)}
                      onDelete={() => setDeleting(t)}
                      revert={<RevertAction table="tasks" item={t} name={t.title} />}
                    />
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
        onAdded={(id) => {
          // "הצגה" opens the timeline tab of this same page, at the new row
          const params = new URLSearchParams(window.location.search);
          params.set("tab", "timeline");
          toast("נוסף ללוח הזמנים", "info", { label: "הצגה", href: `${window.location.pathname}?${params}#item-${id}` });
        }}
        onClose={() => setAdding(null)}
      />
      <TaskDialog
        open={editing !== undefined}
        tenderId={tenderId}
        task={editing ? { ...editing, assignee_ids: assigneesOf(editing) } : null}
        members={members}
        requirements={requirements}
        nextSortOrder={Math.max(0, ...items.map((t) => t.sort_order)) + 1}
        onClose={() => {
          // The dialog saved its own assignees; drop the local copy so the server copy shows
          if (editing) forgetAssignees(editing.id);
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
