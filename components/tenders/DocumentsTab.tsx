"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { useToast } from "@/components/ui/Toast";
import { ACCEPTED_EXTENSIONS, FILE_TYPE_LABELS, fileProblem, formatDate } from "@/lib/tenders";
import { deleteDocument, uploadDocument } from "@/lib/tenders-storage";
import type { TenderDocument } from "@/lib/types";

type Props = {
  tenderId: string;
  documents: TenderDocument[];
  loadFailed: boolean;
};

export function DocumentsTab({ tenderId, documents, loadFailed }: Props) {
  const router = useRouter();
  const toast = useToast();
  const inputId = useId();
  const [progress, setProgress] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TenderDocument | null>(null);

  async function upload(selected: File[]) {
    const problems = selected.map(fileProblem).filter((p): p is string => p !== null);
    const valid = selected.filter((f) => fileProblem(f) === null);
    const failed: string[] = [];
    for (let i = 0; i < valid.length; i++) {
      setProgress(`מעלה קבצים… (${i + 1} מתוך ${valid.length})`);
      if (!(await uploadDocument(tenderId, valid[i]))) failed.push(valid[i].name);
    }
    setProgress(null);
    router.refresh();

    if (failed.length > 0) {
      toast(`לא הצלחנו להעלות: ${failed.join(", ")}. אפשר לנסות שוב.`, "error");
    } else if (problems.length > 0) {
      toast(problems.join(" "), "error");
    } else if (valid.length > 0) {
      toast(valid.length === 1 ? "הקובץ הועלה" : "הקבצים הועלו");
    }
  }

  const uploadButton = (label: string, variant: "secondary" | "primary") => (
    <label
      htmlFor={inputId}
      className={`${buttonClasses(variant, "sm")} ${progress ? "pointer-events-none opacity-50" : ""} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-text`}
    >
      <Upload size={14} strokeWidth={1.75} aria-hidden />
      {label}
    </label>
  );

  return (
    <section aria-labelledby="documents-heading">
      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        disabled={progress !== null}
        className="sr-only"
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (selected.length > 0) upload(selected);
        }}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="documents-heading" className="text-h3">
          מסמכי המכרז
        </h2>
        {documents.length > 0 && uploadButton("העלאת מסמכים נוספים", "secondary")}
      </div>

      {progress && (
        <p role="status" className="mb-3 text-body text-muted">
          {progress}
        </p>
      )}

      {loadFailed && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-control bg-accent-tint px-4 py-2.5 text-accent"
        >
          <span>לא הצלחנו לטעון את רשימת המסמכים.</span>
          <button type="button" onClick={() => router.refresh()} className="font-semibold underline">
            ניסיון חוזר
          </button>
        </div>
      )}

      {documents.length === 0 && !loadFailed && (
        <div className="rounded-card border border-line bg-white px-6 py-10 text-center shadow-card">
          <p className="mb-4 text-body text-muted">אין מסמכים במכרז.</p>
          {uploadButton("העלאת מסמכים", "primary")}
        </div>
      )}

      {documents.length > 0 && (
        <>
          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-table border border-line bg-white md:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">קובץ</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">סוג</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">הועלה</th>
                  <th scope="col" className="w-12 px-2 py-2.5">
                    <span className="sr-only">מחיקה</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2">
                      <bdi>{d.file_name}</bdi>
                    </td>
                    <td className="px-4 py-2">{FILE_TYPE_LABELS[d.file_type]}</td>
                    <td className="px-4 py-2">
                      <span dir="ltr">{formatDate(d.created_at)}</span>
                    </td>
                    <td className="px-2 py-1 text-end">
                      <DeleteButton doc={d} onClick={setDeleting} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per file */}
          <ul className="flex flex-col gap-2 md:hidden">
            {documents.map((d) => (
              <li key={d.id} className="flex items-start gap-2 rounded-card border border-line bg-white p-4 pe-2 shadow-card">
                <div className="min-w-0 flex-1">
                  <p className="text-h3 break-words">
                    <bdi>{d.file_name}</bdi>
                  </p>
                  <dl className="mt-1 text-body">
                    <div className="flex gap-1">
                      <dt className="text-muted">סוג:</dt>
                      <dd>{FILE_TYPE_LABELS[d.file_type]}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted">הועלה:</dt>
                      <dd dir="ltr">{formatDate(d.created_at)}</dd>
                    </div>
                  </dl>
                </div>
                <DeleteButton doc={d} onClick={setDeleting} />
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDeleteDialog
        open={deleting !== null}
        title={deleting ? `למחוק את ${deleting.file_name}?` : ""}
        description="הקובץ יימחק מהמכרז. תוצאות הניתוח הקיימות לא ישתנו. אי אפשר לבטל את הפעולה."
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return true;
          const ok = await deleteDocument(deleting);
          if (ok) {
            setDeleting(null);
            toast("הקובץ נמחק");
            router.refresh();
          }
          return ok;
        }}
      />
    </section>
  );
}

function DeleteButton({ doc, onClick }: { doc: TenderDocument; onClick: (d: TenderDocument) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(doc)}
      aria-label={`מחיקת ${doc.file_name}`}
      title="מחיקה"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-text md:size-9"
    >
      <Trash2 size={16} strokeWidth={1.75} />
    </button>
  );
}
