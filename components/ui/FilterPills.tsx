import Link from "next/link";

type Pill = { key: string; label: string; href: string };

// Department filter pills; the choice lives in the URL so Back keeps it
export function FilterPills({ pills, active, label }: { pills: Pill[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-4">
      <ul className="flex flex-wrap gap-2">
        {pills.map((p) => {
          const isActive = p.key === active;
          return (
            <li key={p.key}>
              <Link
                href={p.href}
                aria-current={isActive ? "page" : undefined}
                scroll={false}
                className={[
                  "inline-flex h-11 items-center rounded-full border px-4 text-[13px] font-medium transition-colors duration-150 md:h-8",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text",
                  isActive
                    ? "border-text bg-text text-white"
                    : "border-input-border bg-white text-text hover:border-text",
                ].join(" ")}
              >
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
