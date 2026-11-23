"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { createClient } from "@/lib/db/client";
import { isOverdue } from "@/lib/analysis";
import type { Requirement, Task } from "@/lib/types";
import { AssigneePicker, type Member } from "./AssigneePicker";
import { ItemSource, itemSourceText } from "./ItemSource";
import { RevertAction } from "./RevertAction";
import { SortSelect, SortTh, useSort } from "./sorting";
import { AddButton, Due, EmptyCard, IconActions, ItemActions, TabHeading, tdClass, thClass, useSave } from "./TabParts";
import { OverdueBadge } from "./Tags";
import { useTaskEdits } from "./useTaskEdits";

// A task shown under its requirement: "בוצע" and assignees are set here, the rest in the tasks tab
export type RequirementTask = Pick<
  Task,
  "id" | "requirement_id" | "title" | "type" | "due_at" | "has_time" | "is_done" | "is_manual" | "assignee_ids" | "source_refs" | "original"
>;

type Props = {
  tenderId: string;
  items: Requirement[];
  tasks: RequirementTask[];
  members: Member[];
  // The tasks tab, for the link on each task's name
  tasksHref: string;
};

// Each requirement with the tasks that come from it, or "לעיון/ידיעה".
// Requirements are edited inline: the text turns into a field with "שמירה" and "ביטול".
export function RequirementsTab({ tenderId, items, tasks, members, tasksHref }: Props) {
  const { save, remove, busy } = useSave();
  const { doneOf, assigneesOf, toggleDone, changeAssignees } = useTaskEdits();
  // A requirement id, "new" for the add row, or null
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Requirement | null>(null);
  // Time of the page load; overdue is recalculated on every refresh
  const [now] = useState(() => Date.now());

  const tasksOf = (r: Requirement) => tasks.filter((t) => t.requirement_id === r.id);
  const firstAssignee = (t: RequirementTask) => members.find((m) => assigneesOf(t).includes(m.id))?.name;

  // By assignees and due date: the first value among the requirement's tasks
  const { sorted, sorting } = useSort(items, [
    { key: "text", label: "דרישה", value: (r) => r.text },
    {
      key: "assignees",
      label: "אחראים",
      value: (r) =>
        tasksOf(r)
          .flatMap((t) => firstAssignee(t) ?? [])
          .sort((a, b) => a.localeCompare(b, "he"))[0] ?? null,
    },
    {
      key: "due",
      label: "מועד",
      value: (r) => {
        const times = tasksOf(r).flatMap((t) => (t.due_at ? [new Date(t.due_at).getTime()] : []));
        return times.length > 0 ? Math.min(...times) : null;
      },
    },
    { key: "source", label: "מקור", value: itemSourceText },
  ]);

  async function submit(text: string, item?: Requirement) {
    const supabase = createClient();
    const ok = item
      ? await save(() => supabase.from("requirements").update({ text, is_manual: true }).eq("id", item.id))
      : await save(() =>
          supabase.from("requirements").insert({
            tender_id: tenderId,
            text,
            is_manual: true,
            sort_order: Math.max(0, ...items.map((r) => r.sort_order)) + 1,
          }),
        );
    if (ok) setEditing(null);
  }

  const doneBox = (t: RequirementTask) => (
    <Checkbox
      checked={doneOf(t)}
      onChange={(e) => toggleDone(t, e.target.checked)}
      aria-label={`בוצע: ${t.title}`}
    />
  );
  const taskName = (t: RequirementTask, late: boolean) => (
    <>
      <Link
        href={`${tasksHref}#item-${t.id}`}
        className={`underline decoration-line underline-offset-4 hover:decoration-text focus-visible:outline-2 focus-visible:outline-text ${
          doneOf(t) ? "text-muted line-through" : ""
        }`}
      >
        {t.title}
      </Link>
      {late && <OverdueBadge className="ms-2" />}
    </>
  );
  const picker = (t: RequirementTask, id: string) => (
    <AssigneePicker
      id={id}
      label={`אחראים למשימה ${t.title}`}
      members={members}
      value={assigneesOf(t)}
      onChange={(ids) => changeAssignees(t, ids)}
    />
  );
  const due = (t: RequirementTask, late: boolean) =>
    t.due_at ? (
      <Due iso={t.due_at} hasTime={t.has_time} className={late ? "font-semibold text-accent" : ""} />
    ) : (
      <span className="text-muted">—</span>
    );
  const isLate = (t: RequirementTask) => isOverdue({ due_at: t.due_at, is_done: doneOf(t) }, now);
  const editRow = (r: Requirement, id: string) => (
    <EditRow id={id} initial={r.text} busy={busy} onSave={(t) => submit(t, r)} onCancel={() => setEditing(null)} />
  );

  return (
    <section aria-labelledby="tab-heading">
      <TabHeading action={<AddButton label="הוספת דרישה" onClick={() => setEditing("new")} />}>
        סיכום דרישות המכרז
      </TabHeading>
      {items.length === 0 && editing !== "new" && <EmptyCard text="אין דרישות. אפשר להוסיף דרישה." />}
      {items.length > 0 && (
        <>
          <SortSelect sorting={sorting} id="requirements-sort" />
          <div className="hidden overflow-hidden rounded-table border border-line bg-white xl:block">
            <table className="w-full table-fixed">
              <thead className="bg-table-head">
                <tr className="text-small text-muted">
                  <SortTh sorting={sorting} column="text" />
                  <SortTh sorting={sorting} column="assignees" className={`${thClass} w-44`} />
                  <SortTh sorting={sorting} column="due" className={`${thClass} w-40`} />
                  <SortTh sorting={sorting} column="source" className={`${thClass} w-60`} />
                  <th scope="col" className="w-32 px-2 py-2.5">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              {sorted.map((r) => {
                const own = tasksOf(r);
                return (
                  <tbody key={r.id} className="border-t border-line">
                    <tr id={`item-${r.id}`} className="scroll-mt-24">
                      {editing === r.id ? (
                        <td colSpan={5} className={tdClass}>
                          {editRow(r, `requirement-${r.id}`)}
                        </td>
                      ) : (
                        <>
                          <td colSpan={3} className={`${tdClass} font-medium [overflow-wrap:anywhere]`}>
                            {r.text}
                            {own.length === 0 && (
                              <div className="mt-1.5">
                                <InfoBadge />
                              </div>
                            )}
                          </td>
                          <td className={`${tdClass} text-small [overflow-wrap:anywhere] text-muted`}>
                            <ItemSource item={r} />
                          </td>
                          <td className="px-2 py-1 text-end align-top whitespace-nowrap">
                            <IconActions
                              name="הדרישה"
                              onEdit={() => setEditing(r.id)}
                              onDelete={() => setDeleting(r)}
                              revert={<RevertAction table="requirements" item={r} name="הדרישה" icon />}
                            />
                          </td>
                        </>
                      )}
                    </tr>
                    {own.map((t) => {
                      const late = isLate(t);
                      return (
                        <tr key={t.id} className={late ? "bg-accent-tint/60" : ""}>
                          <td className="py-1.5 ps-8 pe-4 align-middle">
                            <div className="flex items-center gap-2">
                              {doneBox(t)}
                              <span className="min-w-0 [overflow-wrap:anywhere]">{taskName(t, late)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-1.5 align-middle">{picker(t, `assignees-r-${t.id}`)}</td>
                          <td className="px-4 py-1.5 align-middle">{due(t, late)}</td>
                          <td className="px-4 py-1.5 align-middle text-small [overflow-wrap:anywhere] text-muted">
                            <ItemSource item={t} />
                          </td>
                          <td />
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>

          <ul className="flex flex-col gap-2 xl:hidden">
            {sorted.map((r) => {
              const own = tasksOf(r);
              return (
                <li
                  key={r.id}
                  id={`item-m-${r.id}`}
                  className="rounded-card border border-line bg-white p-4 shadow-card"
                >
                  {editing === r.id ? (
                    editRow(r, `requirement-m-${r.id}`)
                  ) : (
                    <>
                      <p className="font-medium [overflow-wrap:anywhere]">{r.text}</p>
                      <SourceLine item={r} />
                    </>
                  )}
                  {own.length === 0 ? (
                    <div className="mt-2">
                      <InfoBadge />
                    </div>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                      {own.map((t) => {
                        const late = isLate(t);
                        return (
                          <li
                            key={t.id}
                            className={`rounded-control border border-line p-2 pe-3 ${late ? "bg-accent-tint/60" : "bg-surface"}`}
                          >
                            <div className="flex items-start gap-1">
                              {doneBox(t)}
                              <div className="min-w-0 flex-1 pt-2.5 [overflow-wrap:anywhere] md:pt-0">
                                {taskName(t, late)}
                              </div>
                            </div>
                            <div className="mt-1 flex flex-col gap-1 ps-2">
                              {picker(t, `assignees-rm-${t.id}`)}
                              <p>
                                <span className="text-muted">מועד: </span>
                                {due(t, late)}
                              </p>
                              <SourceLine item={t} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {editing !== r.id && (
                    <div className="mt-1 -ms-3">
                      <ItemActions
                        name="הדרישה"
                        onEdit={() => setEditing(r.id)}
                        onDelete={() => setDeleting(r)}
                        revert={<RevertAction table="requirements" item={r} name="הדרישה" />}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editing === "new" && (
        <div className="mt-2 rounded-card border border-line bg-white p-4 shadow-card">
          <EditRow id="requirement-new" initial="" busy={busy} onSave={(t) => submit(t)} onCancel={() => setEditing(null)} />
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleting !== null}
        title="למחוק את הדרישה?"
        description={
          deleting
            ? `"${deleting.text}". ${tasksOf(deleting).length > 0 ? "המשימות הקשורות יישארו ברשימת המשימות. " : ""}אי אפשר לבטל את הפעולה.`
            : ""
        }
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return true;
          const ok = await remove(() => createClient().from("requirements").delete().eq("id", deleting.id), "הדרישה נמחקה");
          if (ok) setDeleting(null);
          return ok;
        }}
      />
    </section>
  );
}

// A requirement that nothing has to be done for
function InfoBadge() {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full bg-line/70 px-2.5 text-small font-normal whitespace-nowrap text-text">
      לעיון/ידיעה
    </span>
  );
}

function SourceLine({ item }: { item: Requirement | RequirementTask }) {
  return (
    <p className="mt-1 text-small [overflow-wrap:anywhere] text-muted">
      מקור: <ItemSource item={item} />
    </p>
  );
}

function EditRow({
  id,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  // Unique per place: a requirement is on the page twice (table and card)
  id: string;
  initial: string;
  busy: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("צריך לכתוב את הדרישה");
      return;
    }
    onSave(text.trim());
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        טקסט הדרישה
      </label>
      <textarea
        id={id}
        value={text}
        autoFocus
        rows={2}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-control border-[1.5px] bg-white px-3 py-2 text-[14px] outline-none focus:ring-3 ${
          error ? "border-accent focus:ring-accent/15" : "border-input-border focus:border-text focus:ring-text/10"
        }`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-small text-accent">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          {busy ? "שומרת…" : "שמירה"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
