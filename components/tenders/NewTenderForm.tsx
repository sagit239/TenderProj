"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, X } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/db/client";
import { DEPARTMENTS, fileProblem, formatFileSize, tenderHref } from "@/lib/tenders";
import { uploadDocument } from "@/lib/tenders-storage";
import { startAnalysis } from "@/lib/analysis";
import type { Department } from "@/lib/types";
import { FileDropzone } from "./FileDropzone";

type Errors = { name?: string; department?: string; files?: string };

export function NewTenderForm() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<Department | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [rejected, setRejected] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const nameError = (value: string) => (value.trim() ? undefined : "יש להזין שם למכרז");

  function addFiles(added: File[]) {
    const problems: string[] = [];
    const next = [...files];
    for (const file of added) {
      const problem = fileProblem(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      // The same file (name + size) is not added twice
      if (!next.some((f) => f.name === file.name && f.size === file.size)) next.push(file);
    }
    setFiles(next);
    setRejected(problems);
    if (next.length > 0) setErrors((e) => ({ ...e, files: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (progress) return;
    const found: Errors = {
      name: nameError(name),
      department: department ? undefined : "יש לבחור מחלקה",
      files: files.length > 0 ? undefined : "יש לבחור לפחות קובץ אחד",
    };
    setErrors(found);
    setFormError(null);
    if (found.name || found.department || found.files) return;

    setProgress("שומרת את המכרז…");
    const { data, error } = await createClient()
      .from("tenders")
      .insert({ name: name.trim(), department })
      .select("id")
      .single();
    if (error || !data) {
      setProgress(null);
      setFormError("שמירת המכרז לא הצליחה. הקבצים עדיין כאן, ואפשר לנסות שוב.");
      return;
    }

    // One file at a time, so the progress text is meaningful
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress(`מעלה קבצים… (${i + 1} מתוך ${files.length})`);
      const ok = await uploadDocument(data.id, files[i]);
      if (!ok) failed.push(files[i].name);
    }

    // Analysis starts as soon as there is something to read; it runs in the background
    if (failed.length < files.length) {
      setProgress("מתחילה את ניתוח המסמכים…");
      await startAnalysis(data.id);
    }

    if (failed.length > 0) {
      toast(`לא הצלחנו להעלות: ${failed.join(", ")}. אפשר להעלות שוב מכאן.`, "error");
      router.push(tenderHref(data.id, "active", "documents"));
    } else {
      toast("המכרז נשמר");
      router.push(tenderHref(data.id, "active"));
    }
  }

  const saving = progress !== null;

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[640px] flex-col gap-5">
      <Field id="tender-name" label="שם המכרז" error={errors.name}>
        <Input
          id="tender-name"
          value={name}
          placeholder="לדוגמה: אספקת ציוד רפואי"
          error={errors.name}
          disabled={saving}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((er) => ({ ...er, name: nameError(e.target.value) }));
          }}
          onBlur={() => name && setErrors((er) => ({ ...er, name: nameError(name) }))}
        />
      </Field>

      <fieldset aria-describedby={errors.department ? "department-error" : undefined}>
        <legend className="mb-1.5 text-[13px] leading-[18px] font-semibold">מחלקה</legend>
        <div className="flex gap-6">
          {DEPARTMENTS.map((d) => (
            <label key={d.key} className="inline-flex min-h-11 cursor-pointer items-center gap-2 md:min-h-8">
              <input
                type="radio"
                name="department"
                value={d.key}
                checked={department === d.key}
                disabled={saving}
                onChange={() => {
                  setDepartment(d.key);
                  setErrors((er) => ({ ...er, department: undefined }));
                }}
                className="size-[18px] cursor-pointer accent-accent"
              />
              {d.label}
            </label>
          ))}
        </div>
        {errors.department && (
          <p id="department-error" role="alert" className="mt-1 text-small text-accent">
            {errors.department}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] leading-[18px] font-semibold">מסמכי המכרז</p>
        <FileDropzone
          onFiles={addFiles}
          invalid={Boolean(errors.files)}
          describedBy={errors.files ? "files-error" : undefined}
        />
        {errors.files && (
          <p id="files-error" role="alert" className="text-small text-accent">
            {errors.files}
          </p>
        )}
        {rejected.length > 0 && (
          <ul role="alert" className="text-small text-accent">
            {rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {files.length > 0 && (
          <ul className="mt-1 flex flex-col gap-2">
            {files.map((f) => (
              <li
                key={`${f.name}-${f.size}`}
                className="flex items-center gap-2 rounded-control border border-line bg-white ps-3 pe-1"
              >
                <FileText size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                <span dir="auto" className="min-w-0 flex-1 truncate py-2 text-start">
                  {f.name}
                </span>
                <span dir="ltr" className="shrink-0 text-small text-muted">
                  {formatFileSize(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((x) => x !== f))}
                  disabled={saving}
                  aria-label={`הסרת ${f.name}`}
                  title="הסרה"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-text md:size-9"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-control bg-accent-tint px-3 py-2 text-accent">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Button type="submit" variant="accent" disabled={saving} className="w-full md:w-auto">
          העלאה וניתוח
        </Button>
        <Link
          href="/tenders"
          aria-disabled={saving}
          className={`${buttonClasses("secondary")} w-full md:w-auto ${saving ? "pointer-events-none opacity-50" : ""}`}
        >
          ביטול
        </Link>
        {progress && (
          <p role="status" className="text-body text-muted">
            {progress}
          </p>
        )}
      </div>
    </form>
  );
}
