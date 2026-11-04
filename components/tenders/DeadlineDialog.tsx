"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { createClient } from "@/lib/db/client";
import { DEADLINE_TYPE_LABELS, FIXED_REMINDER_TEXT, israelTimeToIso, isoToIsraelParts } from "@/lib/analysis";
import type { Deadline, DeadlineType, Task } from "@/lib/types";
import { useSave } from "./TabParts";

type Props = {
  open: boolean;
  tenderId: string;
  deadline: Deadline | null;
  // The deadline's reminder time, when editing
  remindAt?: string | null;
  // "הוספה ללוח הזמנים": the task this new deadline is added for
  fromTask?: Pick<Task, "id" | "title" | "due_at" | "has_time"> | null;
  onClose: () => void;
};

// "מועד" dialog: add or edit a deadline. Its linked task follows it (database trigger).
export function DeadlineDialog({ open, tenderId, deadline, remindAt = null, fromTask = null, onClose }: Props) {
  const title = fromTask ? "הוספה ללוח הזמנים" : deadline ? "עריכת מועד" : "הוספת מועד";
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {open && (
        <DeadlineForm
          key={deadline?.id ?? fromTask?.id ?? "new"}
          tenderId={tenderId}
          deadline={deadline}
          remindAt={remindAt}
          fromTask={fromTask}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

type Values = { title: string; type: DeadlineType; date: string; time: string; remindDate: string; remindTime: string };
type Errors = { title?: string; date?: string; remindDate?: string };

function DeadlineForm({ tenderId, deadline, remindAt, fromTask, onClose }: Omit<Required<Props>, "open">) {
  const source = deadline ?? fromTask;
  const parts = source?.due_at ? isoToIsraelParts(source.due_at) : null;
  const remind = remindAt ? isoToIsraelParts(remindAt) : null;
  const [values, setValues] = useState<Values>({
    title: source?.title ?? "",
    type: deadline?.type ?? "other",
    date: parts?.date ?? "",
    time: source?.has_time && parts ? parts.time : "",
    remindDate: remind?.date ?? "",
    remindTime: remind?.time ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const { save, busy } = useSave();

  const validate = (v: Values): Errors => ({
    title: v.title.trim() ? undefined : "צריך למלא את שם המועד",
    date: v.date ? undefined : "צריך לבחור תאריך",
    remindDate: v.remindTime && !v.remindDate ? "צריך לבחור תאריך לתזכורת" : undefined,
  });

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
      type: values.type,
      due_at: israelTimeToIso(values.date, values.time || null),
      has_time: Boolean(values.time),
      is_manual: true,
    };
    const supabase = createClient();
    const ok = await save(async () => {
      let id = deadline?.id;
      if (deadline) {
        const { error } = await supabase.from("deadlines").update(row).eq("id", deadline.id);
        if (error) return { error };
      } else if (fromTask) {
        const { data, error } = await supabase.rpc("add_task_to_timeline", {
          p_task: fromTask.id,
          p_title: row.title,
          p_type: row.type,
          p_due: row.due_at,
          p_has_time: row.has_time,
        });
        if (error) return { error };
        id = data;
      } else {
        const { data, error } = await supabase
          .from("deadlines")
          .insert({ ...row, tender_id: tenderId })
          .select("id")
          .single();
        if (error) return { error };
        id = data.id;
      }
      // A chosen reminder time applies to "מועד אחר" only; the other types have fixed times
      const remind_at =
        values.type === "other" && values.remindDate
          ? israelTimeToIso(values.remindDate, values.remindTime || null)
          : null;
      return supabase.from("tasks").update({ remind_at }).eq("deadline_id", id!);
    });
    if (ok) onClose();
  }

  // The automatic closing meeting keeps its type
  const types = (Object.keys(DEADLINE_TYPE_LABELS) as DeadlineType[]).filter(
    (t) => t !== "closing_meeting" || deadline?.type === "closing_meeting",
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-1">
      <Field id="deadline-title" label="שם המועד" error={errors.title}>
        <Input
          id="deadline-title"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          onBlur={() => setErrors((er) => ({ ...er, title: validate(values).title }))}
          error={errors.title}
          autoComplete="off"
        />
      </Field>
      <Field id="deadline-type" label="סוג">
        <Select id="deadline-type" value={values.type} onChange={(e) => update("type", e.target.value as DeadlineType)}>
          {types.map((t) => (
            <option key={t} value={t}>
              {DEADLINE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="deadline-date" label="תאריך" error={errors.date}>
          <Input
            id="deadline-date"
            type="date"
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
            onBlur={() => setErrors((er) => ({ ...er, date: validate(values).date }))}
            error={errors.date}
          />
        </Field>
        <Field id="deadline-time" label="שעה (לא חובה)">
          <Input id="deadline-time" type="time" value={values.time} onChange={(e) => update("time", e.target.value)} />
        </Field>
      </div>
      {values.type === "other" ? (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="deadline-remind-date" label="מועד תזכורת (לא חובה)" error={errors.remindDate}>
              <Input
                id="deadline-remind-date"
                type="date"
                value={values.remindDate}
                onChange={(e) => update("remindDate", e.target.value)}
                error={errors.remindDate}
              />
            </Field>
            <Field id="deadline-remind-time" label="שעה">
              <Input
                id="deadline-remind-time"
                type="time"
                value={values.remindTime}
                onChange={(e) => update("remindTime", e.target.value)}
              />
            </Field>
          </div>
          <p className="mt-1.5 text-small text-muted">
            {values.remindDate
              ? "התזכורת תישלח לאחראים. אם אין אחראי, היא תישלח אלייך."
              : "בלי מועד תזכורת, תזכורת תישלח לאחראים יום לפני המועד."}
          </p>
        </div>
      ) : (
        <p className="text-small text-muted">{FIXED_REMINDER_TEXT[values.type]}</p>
      )}
      <p className="text-small text-muted">
        שינוי התאריך מעדכן גם את המשימה הקשורה, את פגישת סגירת הפינות ואת התזכורות.
      </p>
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
