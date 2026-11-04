import Link from "next/link";
import type { ReactNode } from "react";

// White card around a number; with href the whole card is a link
export function StatCard({ href, className = "", children }: { href?: string; className?: string; children: ReactNode }) {
  const base = `block rounded-card border border-line bg-white p-4 shadow-card ${className}`;
  if (!href) return <div className={base}>{children}</div>;
  return (
    <Link
      href={href}
      className={`${base} transition-colors duration-150 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text`}
    >
      {children}
    </Link>
  );
}
