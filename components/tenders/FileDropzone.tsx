"use client";

import { useId, useState } from "react";
import { Upload } from "lucide-react";
import { ACCEPTED_EXTENSIONS } from "@/lib/tenders";

type Props = {
  onFiles: (files: File[]) => void;
  invalid?: boolean;
  describedBy?: string;
};

// Dashed drop area; "בחירת קבצים" is the label of the hidden file input, so it works by keyboard too
export function FileDropzone({ onFiles, invalid, describedBy }: Props) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={[
        "flex flex-col items-center gap-1 rounded-control border-[1.5px] border-dashed px-4 py-6 text-center transition-colors duration-150",
        dragging ? "border-text bg-surface" : invalid ? "border-accent bg-white" : "border-input-border bg-white",
      ].join(" ")}
    >
      <Upload size={22} strokeWidth={1.75} aria-hidden className="mb-1 text-muted" />
      <p className="text-body">
        <span className="hidden md:inline">גרירת קבצים לכאן או </span>
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-accent underline underline-offset-2 hover:text-accent-dark has-[:focus-visible]:outline-2 md:min-h-0"
        >
          בחירת קבצים
          <input
            id={inputId}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            aria-describedby={describedBy}
            className="sr-only"
            onChange={(e) => {
              onFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
      </p>
      <p className="text-small text-muted">PDF, Word, Excel · אפשר כמה קבצים</p>
    </div>
  );
}
