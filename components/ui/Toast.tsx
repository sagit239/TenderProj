"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastKind = "info" | "error";
type ToastState = { id: number; message: string; kind: ToastKind } | null;

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

// Short message at the bottom of the screen; errors stay a little longer
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.kind === "error" ? 7000 : 3500);
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
              "max-w-[480px] rounded-control px-4 py-2.5 text-body font-medium shadow-dialog motion-safe:animate-fade-in",
              toast.kind === "error" ? "bg-accent-tint text-accent" : "bg-text text-white",
            ].join(" ")}
          >
            {toast.message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
