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

// Short text for a proposed item, from the AI payload
function proposalText(p: AnalysisProposal) {
  const x = p.payload as Record<string, string | null>;
  const when = (date: string | null, time: string | null) =>
    date ? formatDue(israelTimeToIso(date, time), Boolean(time)) : null;
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

type Props = {
  run: { id: string; finished_at: string; change_report: ChangeReport | null };
  proposals: AnalysisProposal[];
  // Links for "מעבר לפריט"; missing from the map = the item was deleted since
  itemHrefs: Record<string, string>;
  closeHref: string;
};

// "תוצאות הניתוח מחדש": approve new items, and review items that were not found again
export function ReanalysisDialog({ run, proposals, itemHrefs, closeHref }: Props) {
  const router = useRouter();
  const toast = useToast();
  const pending = proposals.filter((p) => p.status === "pending");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(pending.map((p) => p.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = run.change_report?.missing ?? [];

  const close = () => router.replace(closeHref, { scroll: false });

  async function accept() {
    setSaving(true);
    setError(null);
    const { data, error } = await createClient().rpc("accept_proposals", { p_run: run.id, p_accept: [...checked] });
    setSaving(false);
    if (error) {
      setError("ההוספה לא הצליחה. אפשר לנסות שוב.");
      return;
    }
    toast(data === 0 ? "לא נוספו פריטים" : data === 1 ? "נוסף פריט אחד" : `נוספו ${data} פריטים`);
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

  return (
    <Dialog
      open
      onClose={close}
      title="תוצאות הניתוח מחדש"
      footer={
        pending.length > 0 ? (
          <>
            <Button variant="accent" onClick={accept} disabled={saving}>
              {saving ? "מוסיפה…" : "הוספת הפריטים שסומנו"}
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

      {proposals.length > 0 && (
        <section aria-labelledby="new-items" className="mb-5">
          <h3 id="new-items" className="mb-2 text-h3">
            נמצאו פריטים חדשים
          </h3>
          {ORDER.map((type) => {
            const group = proposals.filter((p) => p.item_type === type);
            if (group.length === 0) return null;
            return (
              <div key={type} className="mb-3">
                <p className="mb-1 text-small font-medium text-muted">{GROUP_LABELS[type]}</p>
                <ul className="flex flex-col">
                  {group.map((p) => (
                    <li key={p.id} className="flex items-start gap-1">
                      {p.status === "pending" ? (
                        <Checkbox
                          checked={checked.has(p.id)}
                          onChange={(e) => toggle(p.id, e.target.checked)}
                          aria-labelledby={`proposal-${p.id}`}
                          className="-ms-2.5 md:ms-0"
                        />
                      ) : (
                        <span className="inline-flex h-11 shrink-0 items-center text-small text-muted md:h-6">
                          {p.status === "accepted" ? "נוסף" : "לא נוסף"}
                        </span>
                      )}
                      <span id={`proposal-${p.id}`} className="py-2.5 text-body md:py-0.5">
                        <span className="me-2 inline-flex h-[20px] items-center rounded-tag bg-accent-tint px-1.5 align-[1px] text-small text-accent">
                          {ITEM_TYPE_LABELS[p.item_type]}
                        </span>
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
