"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/client";
import type { Task } from "@/lib/types";
import { saveAssignees } from "./TaskDialog";
import { useSave } from "./TabParts";

type Editable = Pick<Task, "id" | "is_done" | "assignee_ids">;

// "בוצע" and assignees of a task, with instant feedback. Shared by the tasks tab and the
// tasks under each requirement.
export function useTaskEdits() {
  const { save } = useSave();
  // Local copies; the server copy arrives with the refresh
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [assignees, setAssignees] = useState<Record<string, string[]>>({});

  const doneOf = (t: Editable) => done[t.id] ?? t.is_done;
  const assigneesOf = (t: Editable) => assignees[t.id] ?? t.assignee_ids;

  async function toggleDone(t: Editable, value: boolean) {
    setDone((d) => ({ ...d, [t.id]: value }));
    const ok = await save(
      () => createClient().from("tasks").update({ is_done: value }).eq("id", t.id),
      value ? "המשימה סומנה כבוצעה" : "המשימה חזרה להיות פתוחה",
    );
    if (!ok) setDone((d) => ({ ...d, [t.id]: !value }));
  }

  async function changeAssignees(t: Editable, ids: string[]) {
    const before = assigneesOf(t);
    setAssignees((a) => ({ ...a, [t.id]: ids }));
    const ok = await save(() => saveAssignees(createClient(), t.id, before, ids));
    if (!ok) setAssignees((a) => ({ ...a, [t.id]: before }));
  }

  // Drops the local copy, after the assignees were saved elsewhere (the task dialog)
  const forgetAssignees = (id: string) =>
    setAssignees((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== id)));

  return { doneOf, assigneesOf, toggleDone, changeAssignees, forgetAssignees };
}
