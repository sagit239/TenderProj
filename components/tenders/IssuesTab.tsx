"use client";

import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { createClient } from "@/lib/db/client";
import type { Issue } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { IssueDialog } from "./IssueDialog";
import { AddButton, EmptyCard, ItemActions, Sources, TabHeading, useSave } from "./TabParts";
import { CategoryTag } from "./Tags";

export function IssuesTab({ tenderId, items }: { tenderId: string; items: Issue[] }) {
  const { remove } = useSave();
  const [editing, setEditing] = useState<Issue | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Issue | null>(null);

  return (
    <section aria-labelledby="tab-heading">
      <TabHeading action={<AddButton label="הוספת סעיף" onClick={() => setEditing(null)} />}>סעיפים בעייתיים</TabHeading>
      {items.length === 0 ? (
        <EmptyCard text="לא נמצאו סעיפים בעייתיים." />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((issue) => (
            <li
              key={issue.id}
              id={`item-${issue.id}`}
              className="scroll-mt-24 rounded-card border border-line bg-white p-4 pb-2 shadow-card md:p-5 md:pb-3"
            >
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryTag category={issue.category} />
                  <h3 className="font-semibold">{issue.title}</h3>
                </div>
                {issue.source_refs.length > 0 && (
                  <p className="text-small text-muted md:max-w-[45%] md:text-end">
                    <Sources refs={issue.source_refs} />
                  </p>
                )}
              </div>
              {issue.explanation && <p className="mt-2 text-body text-muted">{issue.explanation}</p>}
              {issue.suggested_question && (
                <div className="mt-3 flex flex-col gap-2 rounded-control bg-surface p-3 md:flex-row md:items-start md:justify-between">
                  <p className="text-body">
                    <span className="font-medium">שאלת הבהרה מוצעת: </span>
                    {issue.suggested_question}
                  </p>
                  <CopyButton text={issue.suggested_question} />
                </div>
              )}
              <div className="mt-2 -ms-3 flex md:justify-end">
                <ItemActions name={issue.title} onEdit={() => setEditing(issue)} onDelete={() => setDeleting(issue)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <IssueDialog
        open={editing !== undefined}
        tenderId={tenderId}
        issue={editing ?? null}
        nextSortOrder={Math.max(0, ...items.map((i) => i.sort_order ?? 0)) + 1}
        onClose={() => setEditing(undefined)}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={deleting ? `למחוק את "${deleting.title}"?` : ""}
        description="הסעיף יימחק מהמכרז. אי אפשר לבטל את הפעולה."
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return true;
          const ok = await remove(() => createClient().from("issues").delete().eq("id", deleting.id), "הסעיף נמחק");
          if (ok) setDeleting(null);
          return ok;
        }}
      />
    </section>
  );
}
