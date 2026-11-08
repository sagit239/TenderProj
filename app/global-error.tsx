"use client";

import "./globals.css";

// Last resort when even the main layout fails: a plain Hebrew page instead of technical details
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body className="flex min-h-dvh items-center justify-center bg-surface px-4 font-sans">
        <div className="w-full max-w-md rounded-card border border-line bg-white px-6 py-12 text-center shadow-card">
          <h1 className="mb-2 text-h2">משהו השתבש</h1>
          <p className="mb-4 text-body text-muted">המערכת לא נטענה. אפשר לנסות שוב בעוד רגע.</p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-[38px] items-center justify-center rounded-control bg-text px-4 font-semibold text-white"
          >
            ניסיון חוזר
          </button>
        </div>
      </body>
    </html>
  );
}
