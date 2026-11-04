"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { createClient } from "@/lib/db/client";
import type { Task } from "@/lib/types";
import { AssigneePicker, type Member } from "./AssigneePicker";
import { useSave } from "./TabParts";

type Supabase = ReturnType<typeof createClient>;

// Adds and removes task_assignees rows so they match `next`
export async function saveAssignees(supabase: Supabase, taskId: string, before: string[], next: string[]) {
  const added = next.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !next.includes(id));
  if (added.length > 0) {
    const { error } = await supabase
      .from("task_assignees")
      .insert(added.map((team_member_id) => ({ task_id: taskId, team_member_id })));
    if (error) return { error };
  }
  if (removed.length > 0) {
    const { error } = await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId)
      .in("team_member_id", removed);
    if (error) return { error };
  }
  return { error: null };
}

type Props = {
  open: boolean;
  tenderId: string;
  task: Task | null;
  members: Member[];
  nextSortOrder: number;
  onClose: () => void;
};

// "משימה" dialog: name and assignees. Dates and reminders are set on the timeline (ADR-24)
export function TaskDialog({ open, tenderId, task, members, nextSortOrder, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={task ? "עריכת משימה" : "הוספת משימה"}>
      {open && (
        <TaskForm
          key={task?.id ?? "new"}
          tenderId={tenderId}
          task={task}
          members={members}
          nextSortOrder={nextSortOrder}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

type Values = { title: string; assignees: string[] };
type Errors = { title?: string };

function TaskForm({ tenderId, task, members, nextSortOrder, onClose }: Omit<Props, "open">) {
  const [values, setValues] = useState<Values>({
    title: task?.title ?? "",
    assignees: task?.assignee_ids ?? [],
  });
  const [errors, setErrors] = useState<Errors>({});
  const { save, busy } = useSave();

  function validate(v: Values): Errors {
    return { title: v.title.trim() ? undefined : "צריך למלא את שם המשימה" };
  }

  function update<K extends keyof Values>(field: K, value: Values[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    setErrors((e) => ({ title: e.title && validate(next).title }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (next.title) return;

    const row = { title: values.title.trim(), is_manual: true };
    const supabase = createClient();
    const ok = await save(async () => {
      if (task) {
        const { error } = await supabase.from("tasks").update(row).eq("id", task.id);
        if (error) return { error };
        return saveAssignees(supabase, task.id, task.assignee_ids, values.assignees);
      }
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...row, tender_id: tenderId, type: "regular", sort_order: nextSortOrder })
        .select("id")
        .single();
      if (error) return { error };
      return saveAssignees(supabase, data.id, [], values.assignees);
    });
    if (ok) onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-1">
      <Field id="task-title" label="שם המשימה" error={errors.title}>
        <Input
          id="task-title"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          onBlur={() => setErrors((er) => ({ ...er, title: validate(values).title }))}
          error={errors.title}
          autoComplete="off"
        />
      </Field>
      {task?.deadline_id && (
        <p className="-mt-2 text-small text-muted">תאריך ותזכורת נערכים בלשונית &quot;לוח זמנים&quot;.</p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-assignees" className="text-[13px] leading-[18px] font-semibold text-text">
          אחראים (לא חובה)
        </label>
        <AssigneePicker
          id="task-assignees"
          label="אחראים"
          members={members}
          value={values.assignees}
          onChange={(ids) => update("assignees", ids)}
          className="md:h-10"
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-2 pb-3">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "שומרת…" : "שמירה"}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
