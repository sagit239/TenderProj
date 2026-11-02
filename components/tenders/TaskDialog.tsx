"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { createClient } from "@/lib/db/client";
import { FIXED_REMINDER_TEXT, hasFixedReminders, israelTimeToIso, isoToIsraelParts } from "@/lib/analysis";
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

// "משימה" dialog: name, due date, assignees and an optional reminder time
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

type Values = { title: string; date: string; time: string; assignees: string[]; remindDate: string; remindTime: string };
type Errors = { title?: string; date?: string; remindDate?: string };

function TaskForm({ tenderId, task, members, nextSortOrder, onClose }: Omit<Props, "open">) {
  const due = task?.due_at ? isoToIsraelParts(task.due_at) : null;
  const remind = task?.remind_at ? isoToIsraelParts(task.remind_at) : null;
  const [values, setValues] = useState<Values>({
    title: task?.title ?? "",
    date: due?.date ?? "",
    time: task?.has_time && due ? due.time : "",
    assignees: task?.assignee_ids ?? [],
    remindDate: remind?.date ?? "",
    remindTime: remind?.time ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const { save, busy } = useSave();
  const type = task?.type ?? "regular";
  const fixed = hasFixedReminders(type);
  // A new task, and a task linked to a deadline, must have a date
  const dateRequired = !task || task.deadline_id !== null || task.due_at !== null;

  function validate(v: Values): Errors {
    return {
      title: v.title.trim() ? undefined : "צריך למלא את שם המשימה",
      date: !dateRequired || v.date ? undefined : "צריך לבחור תאריך",
      remindDate: v.remindTime && !v.remindDate ? "צריך לבחור תאריך לתזכורת" : undefined,
    };
  }

  function update<K extends keyof Values>(field: K, value: Values[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    const now = validate(next);
    setErrors((e) => ({
      title: e.title && now.title,
      date: e.date && now.date,
      remindDate: e.remindDate && now.remindDate,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (next.title || next.date || next.remindDate) return;

    const row = {
      title: values.title.trim(),
      due_at: values.date ? israelTimeToIso(values.date, values.time || null) : null,
      has_time: Boolean(values.date && values.time),
      remind_at: !fixed && values.remindDate ? israelTimeToIso(values.remindDate, values.remindTime || null) : null,
      is_manual: true,
    };
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
      <div className="grid grid-cols-2 gap-3">
        <Field id="task-date" label={dateRequired ? "מועד" : "מועד (לא חובה)"} error={errors.date}>
          <Input
            id="task-date"
            type="date"
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
            onBlur={() => setErrors((er) => ({ ...er, date: validate(values).date }))}
            error={errors.date}
          />
        </Field>
        <Field id="task-time" label="שעה (לא חובה)">
          <Input id="task-time" type="time" value={values.time} onChange={(e) => update("time", e.target.value)} />
        </Field>
      </div>
      {task?.deadline_id && (
        <p className="-mt-2 text-small text-muted">המשימה קשורה למועד בלוח הזמנים. שינוי התאריך יעדכן גם אותו.</p>
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
      {fixed ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] leading-[18px] font-semibold text-text">תזכורות</p>
          <p className="text-body text-muted">{FIXED_REMINDER_TEXT[type]}</p>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="task-remind-date" label="מועד תזכורת (לא חובה)" error={errors.remindDate}>
              <Input
                id="task-remind-date"
                type="date"
                value={values.remindDate}
                onChange={(e) => update("remindDate", e.target.value)}
                error={errors.remindDate}
              />
            </Field>
            <Field id="task-remind-time" label="שעה">
              <Input id="task-remind-time" type="time" value={values.remindTime} onChange={(e) => update("remindTime", e.target.value)} />
            </Field>
          </div>
          {!values.remindDate && <p className="mt-1.5 text-small text-muted">בלי מועד תזכורת לא תישלח תזכורת.</p>}
        </div>
      )}
      <p className="text-small text-muted">התזכורת תישלח לאחראים. אם אין אחראי, היא תישלח אלייך.</p>
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
