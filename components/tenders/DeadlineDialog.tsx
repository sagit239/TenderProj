"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { createClient } from "@/lib/db/client";
import { DEADLINE_TYPE_LABELS, israelTimeToIso, isoToIsraelParts } from "@/lib/analysis";
import type { Deadline, DeadlineType } from "@/lib/types";
import { useSave } from "./TabParts";

type Props = {
  open: boolean;
  tenderId: string;
  deadline: Deadline | null;
  onClose: () => void;
};

// "מועד" dialog: add or edit a deadline. Its linked task follows it (database trigger).
export function DeadlineDialog({ open, tenderId, deadline, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={deadline ? "עריכת מועד" : "הוספת מועד"}>
      {open && <DeadlineForm key={deadline?.id ?? "new"} tenderId={tenderId} deadline={deadline} onClose={onClose} />}
    </Dialog>
  );
}

type Values = { title: string; type: DeadlineType; date: string; time: string };

function DeadlineForm({ tenderId, deadline, onClose }: { tenderId: string; deadline: Deadline | null; onClose: () => void }) {
  const parts = deadline ? isoToIsraelParts(deadline.due_at) : null;
  const [values, setValues] = useState<Values>({
    title: deadline?.title ?? "",
    type: deadline?.type ?? "other",
    date: parts?.date ?? "",
    time: deadline?.has_time && parts ? parts.time : "",
  });
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});
  const { save, busy } = useSave();

  const validate = (v: Values) => ({
    title: v.title.trim() ? undefined : "צריך למלא את שם המועד",
    date: v.date ? undefined : "צריך לבחור תאריך",
  });

  function update<K extends keyof Values>(field: K, value: Values[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (field in errors && errors[field as "title" | "date"] && !validate(next)[field as "title" | "date"]) {
      setErrors((e) => ({ ...e, [field]: undefined }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (next.title || next.date) return;

    const row = {
      title: values.title.trim(),
      type: values.type,
      due_at: israelTimeToIso(values.date, values.time || null),
      has_time: Boolean(values.time),
      is_manual: true,
    };
    const supabase = createClient();
    const ok = await save(() =>
      deadline
        ? supabase.from("deadlines").update(row).eq("id", deadline.id)
        : supabase.from("deadlines").insert({ ...row, tender_id: tenderId }),
    );
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
