"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/db/client";
import { DEADLINE_TYPE_LABELS, ISSUE_CATEGORY_LABELS, ITEM_TYPE_LABELS, formatDue, israelTimeToIso } from "@/lib/analysis";
import { formatDate } from "@/lib/tenders";
import type { AnalysisProposal, ChangeReport, DeadlineType, IssueCategory, ItemType } from "@/lib/types";

const ORDER: ItemType[] = ["requirement", "deadline", "task", "issue"];

const GROUP_LABELS: Record<ItemType, string> = {
  requirement: "דרישות",
  deadline: "מועדים",
  task: "משימות",
  issue: "סעיפים בעייתיים",
};

// The fields an update can change, in display order (ADR-33); "date" is the date and time
const FIELD_LABELS: Record<ItemType, [string, string][]> = {
  requirement: [["text", "דרישה"]],
  deadline: [["title", "שם"], ["date", "מועד"]],
  task: [["title", "שם"], ["date", "תאריך"], ["details", "פירוט"]],
  issue: [["title", "כותרת"], ["explanation", "הסבר"], ["suggested_question", "שאלת הבהרה"]],
};

type Values = Record<string, unknown>;

const when = (date: unknown, time: unknown) =>
  typeof date === "string" && date
    ? formatDue(israelTimeToIso(date, typeof time === "string" ? time : null), Boolean(time))
    : null;

// Short text for a proposed new item, from the AI payload
function proposalText(p: AnalysisProposal) {
  const x = p.payload as Record<string, string | null>;
  switch (p.item_type) {
    case "requirement":
      return x.text ?? "";
    case "deadline": {
      const d = when(x.date, x.time);
      return `${x.title} (${DEADLINE_TYPE_LABELS[x.type as DeadlineType] ?? ""})${d ? ` · ${d}` : ""}`;
    }
    case "task": {
      const d = when(x.date, x.time);
      return d ? `${x.title} · ${d}` : (x.title ?? "");
    }
    case "issue":
      return `${ISSUE_CATEGORY_LABELS[x.category as IssueCategory] ?? ""}: ${x.title}`;
  }
}

// One field's value for the "before" / "after" columns
function fieldText(values: Values, field: string) {
  if (field === "date") return when(values.date, values.time) ?? "בלי תאריך";
  const v = values[field];
  return typeof v === "string" && v.trim() ? v : "—";
}

type Props = {
  run: { id: string; finished_at: string; change_report: ChangeReport | null };
  proposals: AnalysisProposal[];
  // Links for "מעבר לפריט"; missing from the map = the item was deleted since
  itemHrefs: Record<string, string>;
  // Updated deadlines that have a reminder time chosen by hand
  customReminder: string[];
  closeHref: string;
};

// "תוצאות הניתוח מחדש": approve updates and new items, and review items not found again
export function ReanalysisDialog({ run, proposals, itemHrefs, customReminder, closeHref }: Props) {
  const router = useRouter();
  const toast = useToast();
  const changes = proposals.filter((p) => p.target_id);
  const added = proposals.filter((p) => !p.target_id);
  // An update whose item was deleted since cannot be approved
  const deleted = (p: AnalysisProposal) => Boolean(p.target_id && !itemHrefs[p.target_id]);
  const pending = proposals.filter((p) => p.status === "pending" && !deleted(p));
  const [checked, setChecked] = useState<Set<string>>(() => new Set(pending.map((p) => p.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = run.change_report?.missing ?? [];

  const close = () => router.replace(closeHref, { scroll: false });

  async function accept() {
    setSaving(true);
    setError(null);
    const { data, error } = await createClient().rpc("accept_proposals", {
      p_run: run.id,
      p_accept: [...checked].filter((id) => pending.some((p) => p.id === id)),
    });
    setSaving(false);
    if (error) {
      setError("האישור לא הצליח. אפשר לנסות שוב.");
      return;
    }
    const { added: a = 0, updated: u = 0 } = (data ?? {}) as { added?: number; updated?: number };
    const parts = [
      ...(u ? [u === 1 ? "עודכן פריט אחד" : `עודכנו ${u} פריטים`] : []),
      ...(a ? [a === 1 ? "נוסף פריט אחד" : `נוספו ${a} פריטים`] : []),
    ];
    toast(parts.length === 0 ? "לא נוספו ולא עודכנו פריטים" : parts.join(" ו"));
    close();
    router.refresh();
  }

  function toggle(id: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const typeTag = (type: ItemType) => (
    <span className="me-2 inline-flex h-[20px] items-center rounded-tag bg-accent-tint px-1.5 align-[1px] text-small text-accent">
      {ITEM_TYPE_LABELS[type]}
    </span>
  );

  const statusCell = (p: AnalysisProposal, labelledBy: string, done: [string, string]) =>
    p.status === "pending" && !deleted(p) ? (
      <Checkbox
        checked={checked.has(p.id)}
        onChange={(e) => toggle(p.id, e.target.checked)}
        aria-labelledby={labelledBy}
        className="-ms-2.5 md:ms-0"
      />
    ) : (
      <span className="inline-flex h-11 shrink-0 items-center text-small whitespace-nowrap text-muted md:h-6">
        {deleted(p) && p.status !== "accepted" ? "הפריט נמחק" : p.status === "accepted" ? done[0] : done[1]}
      </span>
    );

  return (
    <Dialog
      open
      onClose={close}
      title="תוצאות הניתוח מחדש"
      footer={
        pending.length > 0 ? (
          <>
            <Button variant="accent" onClick={accept} disabled={saving}>
              {saving ? "מאשרת…" : "אישור הפריטים שסומנו"}
            </Button>
            <Button variant="secondary" onClick={close} disabled={saving}>
              לא עכשיו
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={close}>
            סגירה
          </Button>
        )
      }
    >
      <p className="mb-4 text-small text-muted">
        השוואה בין הגרסה הקודמת לגרסה החדשה · <span dir="ltr">{formatDate(run.finished_at)}</span>
      </p>

      {proposals.length === 0 && missing.length === 0 && (
        <p className="mb-2 text-body text-muted">לא נמצאו שינויים במסמכים.</p>
      )}

      {changes.length > 0 && (
        <section aria-labelledby="changed-items" className="mb-5">
          <h3 id="changed-items" className="mb-2 text-h3">
            פריטים שהשתנו
          </h3>
          <ul className="flex flex-col gap-3">
            {changes.map((p) => {
              const before = p.old_payload ?? {};
              const after = p.payload;
              const fields = FIELD_LABELS[p.item_type].filter(([f]) => f in after);
              const name = typeof before.name === "string" ? before.name : null;
              const reason = typeof after.reason === "string" ? after.reason : "";
              const href = p.target_id ? itemHrefs[p.target_id] : undefined;
              const dropsReminder =
                p.item_type === "deadline" && "date" in after && customReminder.includes(p.target_id!);
              return (
                <li key={p.id} className="flex items-start gap-1 border-b border-line pb-3 last:border-b-0">
                  {statusCell(p, `change-${p.id}`, ["עודכן", "לא עודכן"])}
                  <div className="min-w-0 flex-1 py-2.5 md:py-0.5">
                    <p id={`change-${p.id}`} className="text-body">
                      {typeTag(p.item_type)}
                      {name && <span className="font-medium">{name}</span>}
                      {href && (
                        <Link href={href} className="ms-2 text-small text-muted underline">
                          מעבר לפריט
                        </Link>
                      )}
                    </p>
                    <dl className="mt-1.5 flex flex-col gap-2">
                      {fields.map(([field, label]) => (
                        <div key={field}>
                          <dt className="text-small font-medium text-muted">{label}</dt>
                          <dd className="mt-0.5 grid gap-1 md:grid-cols-2 md:gap-3">
                            <p className="rounded-control bg-surface px-2.5 py-1.5 min-w-0 text-small whitespace-pre-line [overflow-wrap:anywhere] text-muted">
                              <span className="block text-[12px] font-medium">לפני</span>
                              <span dir="auto">{fieldText(before, field)}</span>
                            </p>
                            <p className="rounded-control border border-line px-2.5 py-1.5 min-w-0 text-small whitespace-pre-line [overflow-wrap:anywhere]">
                              <span className="block text-[12px] font-medium text-muted">אחרי</span>
                              <span dir="auto">{fieldText(after, field)}</span>
                            </p>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {reason && <p className="mt-1.5 text-small text-muted">{reason}</p>}
                    {dropsReminder && p.status === "pending" && (
                      <p className="mt-1 text-small text-accent">
                        מועד התזכורת שבחרת יבוטל, והתזכורת תחזור להיות אוטומטית.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {added.length > 0 && (
        <section aria-labelledby="new-items" className="mb-5">
          <h3 id="new-items" className="mb-2 text-h3">
            נמצאו פריטים חדשים
          </h3>
          {ORDER.map((type) => {
            const group = added.filter((p) => p.item_type === type);
            if (group.length === 0) return null;
            return (
              <div key={type} className="mb-3">
                <p className="mb-1 text-small font-medium text-muted">{GROUP_LABELS[type]}</p>
                <ul className="flex flex-col">
                  {group.map((p) => (
                    <li key={p.id} className="flex items-start gap-1">
                      {statusCell(p, `proposal-${p.id}`, ["נוסף", "לא נוסף"])}
                      <span id={`proposal-${p.id}`} className="py-2.5 text-body md:py-0.5">
                        {typeTag(p.item_type)}
                        <span className={p.status === "rejected" ? "text-muted" : ""}>{proposalText(p)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {missing.length > 0 && (
        <section aria-labelledby="missing-items" className="mb-2">
          <h3 id="missing-items" className="text-h3">
            לא נמצאו שוב בניתוח החדש
          </h3>
          <p className="mb-2 text-small text-muted">כדאי לבדוק אם השתנו או הוסרו. הם לא נמחקו.</p>
          <ul className="flex flex-col gap-1">
            {missing.map((m) => (
              <li key={m.item_id} className="flex flex-wrap items-center justify-between gap-x-3 text-body text-muted">
                <span>
                  {ITEM_TYPE_LABELS[m.item_type]}: {m.label}
                </span>
                {itemHrefs[m.item_id] ? (
                  <Link href={itemHrefs[m.item_id]} className="inline-flex min-h-11 items-center text-small text-text underline md:min-h-0">
                    מעבר לפריט
                  </Link>
                ) : (
                  <span className="text-small">נמחק</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-control bg-accent-tint px-3 py-2 text-accent">
          {error}
        </p>
      )}
    </Dialog>
  );
}
