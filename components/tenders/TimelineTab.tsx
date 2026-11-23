"use client";

import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/db/client";
import { highlightItem } from "./ScrollToItem";
import { DEADLINE_TYPE_LABELS, NEEDS_ASSIGNEE, formatSourceRef, reminderLabel } from "@/lib/analysis";
import { ReminderToggle } from "./ReminderToggle";
import type { Deadline, Task } from "@/lib/types";
import { AssigneePicker, type Member } from "./AssigneePicker";
import { DeadlineDialog } from "./DeadlineDialog";
import { RevertAction } from "./RevertAction";
import { SortSelect, SortTh, useSort } from "./sorting";
import { saveAssignees } from "./TaskDialog";
import { AddButton, Due, EmptyCard, IconActions, ItemActions, Sources, TabHeading, tdClass, thClass, useSave } from "./TabParts";

// The task linked to a deadline: assignees and reminders are set on it (PRD F6, F7)
export type TimelineTask = Pick<
  Task,
  "id" | "deadline_id" | "type" | "due_at" | "has_time" | "remind_at" | "reminders_off" | "assignee_ids"
>;

// An edited deadline from the documents keeps its reference
function deadlineSource(d: Deadline) {
  if (d.is_auto && !d.is_manual) return "אוטומטי (3 ימי עבודה לפני ההגשה)";
  if (d.source_refs.length > 0) return <Sources refs={d.source_refs} />;
  return d.is_manual ? "ידני" : "—";
}

function deadlineSourceText(d: Deadline) {
  const source = deadlineSource(d);
  if (typeof source !== "string") return d.source_refs.map(formatSourceRef).join(" / ");
  return source === "—" ? null : source;
}

type Props = { tenderId: string; items: Deadline[]; tasks: TimelineTask[]; members: Member[] };

export function TimelineTab({ tenderId, items, tasks, members }: Props) {
  const { save, remove } = useSave();
  const toast = useToast();
  // undefined = closed, null = adding, Deadline = editing
  const [editing, setEditing] = useState<Deadline | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Deadline | null>(null);
  // Local copies for instant feedback; the server copy arrives with the refresh
  const [assignees, setAssignees] = useState<Record<string, string[]>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});

  const taskOf = (d: Deadline) => tasks.find((t) => t.deadline_id === d.id);
  const assigneesOf = (t: TimelineTask) => assignees[t.id] ?? t.assignee_ids;
  const offOf = (t: TimelineTask) => off[t.id] ?? t.reminders_off;
  const reminderText = (t: TimelineTask) =>
    offOf(t) ? "ללא תזכורת" : reminderLabel({ ...t, reminders_off: false }, assigneesOf(t).length > 0);

  const { sorted, sorting } = useSort(items, [
    { key: "title", label: "מועד", value: (d) => d.title },
    { key: "type", label: "סוג", value: (d) => DEADLINE_TYPE_LABELS[d.type] },
    { key: "due", label: "תאריך ושעה", value: (d) => new Date(d.due_at).getTime() },
    {
      key: "assignees",
      label: "אחראים",
      value: (d) => {
        const t = taskOf(d);
        return (t && members.find((m) => assigneesOf(t).includes(m.id))?.name) ?? null;
      },
    },
    {
      key: "reminder",
      label: "תזכורת",
      value: (d) => {
        const t = taskOf(d);
        return t ? reminderText(t) : null;
      },
    },
    { key: "source", label: "מקור", value: deadlineSourceText },
  ]);

  async function changeAssignees(t: TimelineTask, ids: string[]) {
    const before = assigneesOf(t);
    setAssignees((a) => ({ ...a, [t.id]: ids }));
    const ok = await save(() => saveAssignees(createClient(), t.id, before, ids));
    if (!ok) setAssignees((a) => ({ ...a, [t.id]: before }));
  }

  async function toggleReminders(t: TimelineTask, send: boolean) {
    setOff((o) => ({ ...o, [t.id]: !send }));
    const ok = await save(
      () => createClient().from("tasks").update({ reminders_off: !send }).eq("id", t.id),
      send ? "התזכורות הופעלו" : "התזכורות בוטלו",
    );
    if (!ok) setOff((o) => ({ ...o, [t.id]: send }));
  }

  const picker = (d: Deadline, id: string) => {
    const t = taskOf(d);
    if (!t) return <span className="text-muted">—</span>;
    return (
      <AssigneePicker
        id={id}
        label={`אחראים למועד ${d.title}`}
        members={members}
        value={assigneesOf(t)}
        onChange={(ids) => changeAssignees(t, ids)}
      />
    );
  };

  // "עם תזכורת" = reminders go out; "ללא תזכורת" switches them off
  const reminder = (d: Deadline) => {
    const t = taskOf(d);
    if (!t) return <span className="text-muted">—</span>;
    const sends = !offOf(t);
    const when = reminderLabel({ ...t, reminders_off: false }, assigneesOf(t).length > 0);
    return (
      <ReminderToggle
        on={sends}
        label={`תזכורת: ${d.title}`}
        note={sends ? when : null}
        muted={when === NEEDS_ASSIGNEE}
        onChange={(send) => toggleReminders(t, send)}
      />
    );
  };

  return (
    <section aria-labelledby="tab-heading">
      <TabHeading action={<AddButton label="הוספת מועד" onClick={() => setEditing(null)} />}>מועדי המכרז</TabHeading>
      {items.length === 0 ? (
        <EmptyCard text="לא נמצאו מועדים במסמכי המכרז. אפשר להוסיף מועדים ידנית." />
      ) : (
        <>
          <SortSelect sorting={sorting} id="timeline-sort" />
          <div className="hidden overflow-hidden rounded-table border border-line bg-white xl:block">
            <table className="w-full table-fixed">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <SortTh sorting={sorting} column="title" />
                  <SortTh sorting={sorting} column="type" className={`${thClass} w-28`} />
                  <SortTh sorting={sorting} column="due" className={`${thClass} w-36`} />
                  <SortTh sorting={sorting} column="assignees" className={`${thClass} w-38`} />
                  <SortTh sorting={sorting} column="reminder" className="w-48 px-2 py-2.5 text-start font-medium" />
                  <SortTh sorting={sorting} column="source" className={`${thClass} w-40`} />
                  <th scope="col" className="w-29 px-1 py-2.5">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.id} id={`item-${d.id}`} className="scroll-mt-24 border-b border-line last:border-b-0">
                    <td className={`${tdClass} font-medium [overflow-wrap:anywhere]`}>{d.title}</td>
                    <td className={tdClass}>{DEADLINE_TYPE_LABELS[d.type]}</td>
                    <td className={tdClass}>
                      <Due iso={d.due_at} hasTime={d.has_time} />
                    </td>
                    <td className="px-4 py-1.5 align-middle">{picker(d, `assignees-${d.id}`)}</td>
                    <td className="px-2 py-1 align-middle">{reminder(d)}</td>
                    <td className={`${tdClass} text-small [overflow-wrap:anywhere] text-muted`}>{deadlineSource(d)}</td>
                    <td className="px-1 py-1 text-end whitespace-nowrap">
                      <IconActions
                        name={d.title}
                        onEdit={() => setEditing(d)}
                        onDelete={() => setDeleting(d)}
                        deleteLabel="הסרה"
                        revert={<RevertAction table="deadlines" item={d} name={d.title} icon />}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 xl:hidden">
            {sorted.map((d) => (
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
                  <div className="flex flex-col gap-1 pt-1">
                    <dt className="text-muted">אחראים</dt>
                    <dd>{picker(d, `assignees-m-${d.id}`)}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="sr-only">תזכורת</dt>
                    <dd>{reminder(d)}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="shrink-0 text-muted">מקור:</dt>
                    <dd className="min-w-0 break-words text-small text-muted">{deadlineSource(d)}</dd>
                  </div>
                </dl>
                <div className="mt-2 -ms-3 flex">
                  <ItemActions
                    name={d.title}
                    onEdit={() => setEditing(d)}
                    onDelete={() => setDeleting(d)}
                    deleteLabel="הסרה"
                    revert={<RevertAction table="deadlines" item={d} name={d.title} />}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <DeadlineDialog
        open={editing !== undefined}
        tenderId={tenderId}
        deadline={editing ?? null}
        remindAt={editing ? taskOf(editing)?.remind_at : null}
        onAdded={(id) => {
          toast("המועד נוסף");
          highlightItem(id);
        }}
        onClose={() => setEditing(undefined)}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={deleting ? `להסיר את "${deleting.title}" מלוח הזמנים?` : ""}
        description="המשימה תישאר ברשימת המשימות, בלי תזכורות."
        confirmLabel="הסרה"
        busyLabel="מסירה…"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return true;
          const ok = await remove(
            () => createClient().rpc("remove_from_timeline", { p_deadline: deleting.id }),
            "המועד הוסר מלוח הזמנים",
          );
          if (ok) setDeleting(null);
          return ok;
        }}
      />
    </section>
  );
}
