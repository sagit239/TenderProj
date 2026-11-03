"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  // For dialogs that hold a table
  wide?: boolean;
};

// Modal built on the native <dialog>: focus trap, Esc and focus restore come from the browser
export function Dialog({ open, onClose, title, children, footer, wide = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop closes the dialog
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100%-16px)] ${wide ? "max-w-[720px]" : "max-w-[480px]"} max-h-[calc(100dvh-16px)] rounded-card bg-white p-0 text-text shadow-dialog backdrop:bg-ink/50 open:motion-safe:animate-fade-in`}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-16px)] flex-col">
          <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
            <h2 id="dialog-title" className="text-h2">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="-me-2 inline-flex size-11 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-text md:size-9"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pb-2">{children}</div>
          {footer && (
            <div className="flex flex-wrap gap-2 px-5 pt-3 pb-5">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
