"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

// A friendly page for an unexpected error inside the app; the technical details stay in the server log
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-card border border-line bg-white px-6 py-12 text-center shadow-card">
      <h1 className="mb-2 text-h2">משהו השתבש</h1>
      <p className="mb-4 text-body text-muted">הדף לא נטען. אפשר לנסות שוב, או לחזור ללוח הבקרה.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={buttonClasses("primary")}>
          ניסיון חוזר
        </button>
        <Link href="/dashboard" className={buttonClasses("secondary")}>
          מעבר ללוח הבקרה
        </Link>
      </div>
    </div>
  );
}
