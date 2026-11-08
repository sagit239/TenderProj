"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastKind = "info" | "error";
// An optional link next to the message, e.g. "הצגה" to the item that was just added
type ToastAction = { label: string; href: string };
type ToastState = { id: number; message: string; kind: ToastKind; action?: ToastAction } | null;

const ToastContext = createContext<(message: string, kind?: ToastKind, action?: ToastAction) => void>(() => {});

// Short message at the bottom of the screen; errors and messages with a link stay a little longer
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "info", action?: ToastAction) => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, kind, action });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.kind === "error" || toast.action ? 7000 : 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center"
      >
        {toast && (
          <p
            key={toast.id}
            className={[
              "flex max-w-[480px] flex-wrap items-center gap-x-3 rounded-control px-4 py-2.5 text-body font-medium shadow-dialog motion-safe:animate-fade-in",
              toast.kind === "error" ? "bg-accent-tint text-accent" : "bg-text text-white",
              toast.action ? "pointer-events-auto" : "",
            ].join(" ")}
          >
            {toast.message}
            {toast.action && (
              <Link
                href={toast.action.href}
                scroll={false}
                onClick={() => setToast(null)}
                className="inline-flex min-h-11 items-center font-semibold underline md:min-h-0"
              >
                {toast.action.label}
              </Link>
            )}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
