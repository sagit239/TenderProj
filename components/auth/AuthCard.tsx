import type { ReactNode } from "react";

// Split background with a centered card: login, password reset and new password screens
export function AuthCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-[linear-gradient(to_bottom,var(--color-ink)_35%,var(--color-surface)_35%)] px-4 pt-[12vh] pb-10">
      <div className="mx-auto w-full max-w-[360px] rounded-card bg-white px-6 pt-8 pb-7 shadow-dialog">
        <div className="mb-7 text-center">
          <h1 className="text-display text-text">ניהול מכרזים</h1>
          <div aria-hidden className="mx-auto mt-3 h-[3px] w-8 rounded-full bg-accent" />
          <p className="mt-3 text-body text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export const authLinkClass =
  "inline-flex min-h-11 items-center text-small text-muted underline underline-offset-2 hover:text-text focus-visible:outline-2 focus-visible:outline-text md:min-h-0";
