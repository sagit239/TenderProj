"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { createClient } from "@/lib/db/client";
import type { Original } from "@/lib/types";
import { iconActionClass, useSave } from "./TabParts";

const FIELD_LABELS: Record<string, string> = {
  text: "דרישה",
  title: "שם",
  details: "פירוט",
  explanation: "הסבר",
  suggested_question: "שאלת הבהרה",
};

type Props = {
  table: "requirements" | "deadlines" | "tasks" | "issues";
  item: { id: string; original: Original };
  // Accessible name of the item
  name: string;
  // Icon only, for table rows
  icon?: boolean;
};

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// "↺ חזרה למקור": brings back the last text that came from the documents (ADR-34).
// Shown only for an analysed item whose text is different now.
export function RevertAction({ table, item, name, icon = false }: Props) {
  const [open, setOpen] = useState(false);
  const { save, busy } = useSave();
  const original = item.original ?? {};
  const changed = Object.keys(FIELD_LABELS).filter(
    (f) => f in original && norm(original[f]) !== norm((item as Record<string, unknown>)[f]),
  );
  if (changed.length === 0) return null;

  async function revert() {
    const values = Object.fromEntries(changed.map((f) => [f, original[f]]));
    const ok = await save(() => createClient().from(table).update(values).eq("id", item.id), "הנוסח הוחזר");
    if (ok) setOpen(false);
  }

  return (
    <>
      {icon ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`חזרה למקור: ${name}`}
          title="חזרה למקור"
          className={iconActionClass}
        >
          <Undo2 size={16} strokeWidth={1.75} />
        </button>
      ) : (
        <>
          <span aria-hidden>·</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`חזרה למקור: ${name}`}>
            <Undo2 size={14} strokeWidth={1.75} aria-hidden />
            חזרה למקור
          </Button>
        </>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="לחזור לנוסח של הניתוח?"
        footer={
          <>
            <Button variant="primary" onClick={revert} disabled={busy}>
              {busy ? "מחזירה…" : "חזרה למקור"}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              ביטול
            </Button>
          </>
        }
      >
        <div className="text-start text-body whitespace-normal">
          <p>הנוסח שערכת יוחלף. האחראים, &quot;בוצע&quot; והתזכורות לא משתנים.</p>
          <dl className="mt-3 flex flex-col gap-2 rounded-control bg-surface p-3 text-muted">
            {changed.map((f) => (
              <div key={f}>
                <dt className={changed.length > 1 ? "text-small font-medium" : "sr-only"}>{FIELD_LABELS[f]}</dt>
                <dd className="[overflow-wrap:anywhere] whitespace-pre-line">{norm(original[f]) || "(ריק)"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Dialog>
    </>
  );
}
