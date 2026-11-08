"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DateInput, isIsoDate, isTime, TimeInput } from "@/components/ui/DateTimeInputs";
import { Field, Input, Select } from "@/components/ui/Field";
import { createClient } from "@/lib/db/client";
import { DEADLINE_TYPE_LABELS, formatDue, israelTimeToIso, isoToIsraelParts } from "@/lib/analysis";
import type { Deadline, DeadlineType, Task } from "@/lib/types";
import { useSave } from "./TabParts";

type Props = {
  open: boolean;
  tenderId: string;
  deadline: Deadline | null;
  // The reminder time chosen by the user, when editing
  remindAt?: string | null;
  // "הוספה ללוח הזמנים": the task this new deadline is added for
  fromTask?: Pick<Task, "id" | "title" | "due_at" | "has_time"> | null;
  // Called with the new deadline's id after an add, instead of the plain "נשמר" message
  onAdded?: ((deadlineId: string) => void) | null;
  onClose: () => void;
};

// "מועד" dialog: add or edit a deadline. Its linked task follows it (database trigger).
export function DeadlineDialog({ open, tenderId, deadline, remindAt = null, fromTask = null, onAdded = null, onClose }: Props) {
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
          onAdded={onAdded}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

type Values = { title: string; type: DeadlineType; date: string; time: string; remindDate: string; remindTime: string };
type Errors = { title?: string; date?: string; time?: string; remindDate?: string; remindTime?: string };
type Remind = { date: string; time: string };

const BAD_DATE = "התאריך לא תקין. כותבים יום/חודש/שנה";
const BAD_TIME = "השעה לא תקינה. כותבים למשל 14:30";

function DeadlineForm({ tenderId, deadline, remindAt, fromTask, onAdded, onClose }: Omit<Required<Props>, "open">) {
  const source = deadline ?? fromTask;
  const parts = source?.due_at ? isoToIsraelParts(source.due_at) : null;
  // An existing date is always shown as it is, without editing; only a new item without a date asks for one
  const fixedDate = Boolean(source?.due_at);
  const chosen = remindAt ? isoToIsraelParts(remindAt) : null;
  // What the reminder field showed when the dialog opened; saving it unchanged keeps the reminders as they are
  const [initialRemind, setInitialRemind] = useState<Remind>({ date: chosen?.date ?? "", time: chosen?.time ?? "" });
  const [values, setValues] = useState<Values>({
    title: source?.title ?? "",
    type: deadline?.type ?? "other",
    date: parts?.date ?? "",
    time: source?.has_time && parts ? parts.time : "",
    remindDate: initialRemind.date,
    remindTime: initialRemind.time,
  });
  const [errors, setErrors] = useState<Errors>({});
  const { save, busy } = useSave();

  // Without a chosen time, the field shows the next automatic reminder (when the item has one)
  useEffect(() => {
    if (!deadline || remindAt) return;
    let active = true;
    createClient()
      .from("reminders")
      .select("send_at, tasks!inner(deadline_id)")
      .eq("tasks.deadline_id", deadline.id)
      .eq("status", "pending")
      .order("send_at")
      .limit(1)
      .then(({ data }) => {
        const next = data?.[0]?.send_at;
        if (!active || !next) return;
        const p = isoToIsraelParts(next);
        setInitialRemind(p);
        // Fill only if the user has not typed a reminder meanwhile
        setValues((v) => (v.remindDate || v.remindTime ? v : { ...v, remindDate: p.date, remindTime: p.time }));
      });
    return () => {
      active = false;
    };
  }, [deadline, remindAt]);

  const validate = (v: Values): Errors => ({
    title: v.title.trim() ? undefined : "צריך למלא את שם המועד",
    date: !v.date ? "צריך לבחור תאריך" : isIsoDate(v.date) ? undefined : BAD_DATE,
    time: v.time && !isTime(v.time) ? BAD_TIME : undefined,
    remindDate:
      v.remindTime && !v.remindDate
        ? "צריך לבחור תאריך לתזכורת"
        : v.remindDate && !isIsoDate(v.remindDate)
          ? BAD_DATE
          : undefined,
    remindTime: v.remindTime && !isTime(v.remindTime) ? BAD_TIME : undefined,
  });

  function update<K extends keyof Values>(field: K, value: Values[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    const now = validate(next);
    setErrors((e) => ({
      title: e.title && now.title,
      date: e.date && now.date,
      time: e.time && now.time,
      remindDate: e.remindDate && now.remindDate,
      remindTime: e.remindTime && now.remindTime,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const row = {
      title: values.title.trim(),
      type: values.type,
      due_at: israelTimeToIso(values.date, values.time || null),
      has_time: Boolean(values.time),
      is_manual: true,
    };
    const remindChanged = values.remindDate !== initialRemind.date || values.remindTime !== initialRemind.time;
    const supabase = createClient();
    let savedId: string | undefined;
    const announce = !deadline && onAdded;
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
      savedId = id;
      if (!remindChanged) return { error: null };
      // A chosen reminder time replaces the automatic reminders; an emptied field brings them back
      const remind_at = values.remindDate ? israelTimeToIso(values.remindDate, values.remindTime || null) : null;
      return supabase.from("tasks").update({ remind_at }).eq("deadline_id", id!);
    }, announce ? "" : undefined);
    if (!ok) return;
    onClose();
    if (announce && savedId) onAdded(savedId);
  }

  // A closing meeting is created automatically, never added by hand
  const types = (Object.keys(DEADLINE_TYPE_LABELS) as DeadlineType[]).filter((t) => t !== "closing_meeting");

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
      {/* The type is chosen only for a new deadline; an existing one shows it, and a task added to the timeline is "מועד אחר" */}
      {deadline ? (
        <div>
          <p className="mb-1 text-small font-semibold">סוג</p>
          <p className="text-body">{DEADLINE_TYPE_LABELS[deadline.type]}</p>
        </div>
      ) : (
        !fromTask && (
          <Field id="deadline-type" label="סוג">
            <Select id="deadline-type" value={values.type} onChange={(e) => update("type", e.target.value as DeadlineType)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {DEADLINE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
        )
      )}
      {fixedDate && source?.due_at ? (
        <div>
          <p className="mb-1 text-small font-semibold">מועד</p>
          <p className="text-body">
            <span dir="ltr">{formatDue(source.due_at, source.has_time)}</span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field id="deadline-date" label="תאריך" error={errors.date}>
            <DateInput
              id="deadline-date"
              value={values.date}
              onChange={(date) => update("date", date)}
              onBlur={() => setErrors((er) => ({ ...er, date: validate(values).date }))}
              error={errors.date}
            />
          </Field>
          <Field id="deadline-time" label="שעה (לא חובה)" error={errors.time}>
            <TimeInput id="deadline-time" value={values.time} onChange={(time) => update("time", time)} error={errors.time} />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field id="deadline-remind-date" label="מועד תזכורת" error={errors.remindDate}>
          <DateInput
            id="deadline-remind-date"
            value={values.remindDate}
            onChange={(date) => update("remindDate", date)}
            error={errors.remindDate}
          />
        </Field>
        <Field id="deadline-remind-time" label="שעה" error={errors.remindTime}>
          <TimeInput
            id="deadline-remind-time"
            value={values.remindTime}
            onChange={(time) => update("remindTime", time)}
            error={errors.remindTime}
          />
        </Field>
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
