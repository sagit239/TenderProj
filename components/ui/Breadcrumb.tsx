import Link from "next/link";

// "<list> › <current>" above the page title; the link goes back to the list
export function Breadcrumb({ href, label, current }: { href: string; label: string; current?: string }) {
  return (
    <nav aria-label="מיקום" className="mb-1 text-small text-muted">
      <Link href={href} className="hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-text">
        {label}
      </Link>
      <span aria-hidden> › </span>
      {current && <span aria-current="page">{current}</span>}
    </nav>
  );
}
