"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { createClient } from "@/lib/db/client";
import type { Requirement } from "@/lib/types";
import { AddButton, EmptyCard, ItemActions, TabHeading, useSave } from "./TabParts";

// Requirements are edited inline: the text turns into a field with "שמירה" and "ביטול"
export function RequirementsTab({ tenderId, items }: { tenderId: string; items: Requirement[] }) {
  const { save, remove, busy } = useSave();
  // A requirement id, "new" for the add row, or null
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Requirement | null>(null);

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

  return (
    <section aria-labelledby="tab-heading">
      <TabHeading action={<AddButton label="הוספת דרישה" onClick={() => setEditing("new")} />}>
        סיכום דרישות המכרז
      </TabHeading>
      {items.length === 0 && editing !== "new" ? (
        <EmptyCard text="אין דרישות. אפשר להוסיף דרישה." />
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-white px-4 py-1 shadow-card md:px-6">
          {items.map((r) => (
            <li key={r.id} id={`item-${r.id}`} className="scroll-mt-24 py-2">
              {editing === r.id ? (
                <EditRow initial={r.text} busy={busy} onSave={(t) => submit(t, r)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
                  <p className="flex gap-2 pt-1">
                    <span aria-hidden className="text-muted">•</span>
                    <span>{r.text}</span>
                  </p>
                  <div className="-ms-3 md:ms-0">
                    <ItemActions name="הדרישה" onEdit={() => setEditing(r.id)} onDelete={() => setDeleting(r)} />
                  </div>
                </div>
              )}
            </li>
          ))}
          {editing === "new" && (
            <li className="py-2">
              <EditRow initial="" busy={busy} onSave={(t) => submit(t)} onCancel={() => setEditing(null)} />
            </li>
          )}
        </ul>
      )}

      <ConfirmDeleteDialog
        open={deleting !== null}
        title="למחוק את הדרישה?"
        description={deleting ? `"${deleting.text}". אי אפשר לבטל את הפעולה.` : ""}
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

function EditRow({
  initial,
  busy,
  onSave,
  onCancel,
}: {
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
      <label htmlFor="requirement-text" className="sr-only">
        טקסט הדרישה
      </label>
      <textarea
        id="requirement-text"
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
        aria-describedby={error ? "requirement-text-error" : undefined}
        className={`w-full rounded-control border-[1.5px] bg-white px-3 py-2 text-[14px] outline-none focus:ring-3 ${
          error ? "border-accent focus:ring-accent/15" : "border-input-border focus:border-text focus:ring-text/10"
        }`}
      />
      {error && (
        <p id="requirement-text-error" role="alert" className="text-small text-accent">
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
