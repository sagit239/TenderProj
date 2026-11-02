"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { createClient } from "@/lib/db/client";
import { ISSUE_CATEGORY_LABELS, formatSourceRef } from "@/lib/analysis";
import type { Issue, IssueCategory } from "@/lib/types";
import { useSave } from "./TabParts";

type Props = {
  open: boolean;
  tenderId: string;
  issue: Issue | null;
  nextSortOrder: number;
  onClose: () => void;
};

// "סעיף בעייתי" dialog: add or edit an issue
export function IssueDialog({ open, tenderId, issue, nextSortOrder, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={issue ? "עריכת סעיף בעייתי" : "הוספת סעיף בעייתי"}>
      {open && (
        <IssueForm key={issue?.id ?? "new"} tenderId={tenderId} issue={issue} nextSortOrder={nextSortOrder} onClose={onClose} />
      )}
    </Dialog>
  );
}

const sourcesText = (issue: Issue | null) => (issue ? issue.source_refs.map(formatSourceRef).join(" / ") : "");

const textareaClass =
  "w-full rounded-control border-[1.5px] border-input-border bg-white px-3 py-2 text-[14px] outline-none focus:border-text focus:ring-3 focus:ring-text/10";

function IssueForm({ tenderId, issue, nextSortOrder, onClose }: Omit<Props, "open">) {
  const [category, setCategory] = useState<IssueCategory | "">(issue?.category ?? "");
  const [title, setTitle] = useState(issue?.title ?? "");
  const [explanation, setExplanation] = useState(issue?.explanation ?? "");
  const [source, setSource] = useState(sourcesText(issue));
  const [question, setQuestion] = useState(issue?.suggested_question ?? "");
  const [errors, setErrors] = useState<{ category?: string; title?: string }>({});
  const { save, busy } = useSave();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      category: category ? undefined : "צריך לבחור קטגוריה",
      title: title.trim() ? undefined : "צריך למלא כותרת",
    };
    setErrors(next);
    if (next.category || next.title) return;

    // An unchanged source keeps the AI's structured references
    const refs =
      issue && source.trim() === sourcesText(issue)
        ? issue.source_refs
        : source.trim()
          ? [{ file_name: source.trim(), page: null, section: null }]
          : [];
    const row = {
      category,
      title: title.trim(),
      explanation: explanation.trim(),
      source_refs: refs,
      suggested_question: question.trim(),
      is_manual: true,
    };
    const supabase = createClient();
    const ok = await save(() =>
      issue
        ? supabase.from("issues").update(row).eq("id", issue.id)
        : supabase.from("issues").insert({ ...row, tender_id: tenderId, sort_order: nextSortOrder }),
    );
    if (ok) onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-1">
      <Field id="issue-category" label="קטגוריה" error={errors.category}>
        <Select
          id="issue-category"
          value={category}
          error={errors.category}
          onChange={(e) => {
            setCategory(e.target.value as IssueCategory);
            setErrors((er) => ({ ...er, category: undefined }));
          }}
        >
          <option value="" disabled>
            בחירת קטגוריה
          </option>
          {(Object.keys(ISSUE_CATEGORY_LABELS) as IssueCategory[]).map((c) => (
            <option key={c} value={c}>
              {ISSUE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="issue-title" label="כותרת" error={errors.title}>
        <Input
          id="issue-title"
          value={title}
          error={errors.title}
          autoComplete="off"
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) setErrors((er) => ({ ...er, title: undefined }));
          }}
          onBlur={() => setErrors((er) => ({ ...er, title: title.trim() ? undefined : "צריך למלא כותרת" }))}
        />
      </Field>
      <Field id="issue-explanation" label="הסבר">
        <textarea id="issue-explanation" rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} className={textareaClass} />
      </Field>
      <Field id="issue-source" label="מקור" hint="שם הקובץ, עמוד וסעיף">
        <Input id="issue-source" value={source} onChange={(e) => setSource(e.target.value)} autoComplete="off" placeholder="חוזה.pdf · עמ' 14, סעיף 7.2" />
      </Field>
      <Field id="issue-question" label="שאלת הבהרה מוצעת">
        <textarea id="issue-question" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} className={textareaClass} />
      </Field>
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
