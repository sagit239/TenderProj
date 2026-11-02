import Link from "next/link";

type Tab = { key: string; label: string; href: string };

// Underlined tabs (3px red line on the active one); scrolls sideways on narrow screens
export function Tabs({ tabs, active, label }: { tabs: Tab[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-5 border-b border-line md:mx-0">
      <ul className="flex overflow-x-auto px-4 [scrollbar-width:none] md:px-0">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <li key={t.key} className="shrink-0">
              <Link
                href={t.href}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "-mb-px inline-flex h-11 items-center border-b-[3px] px-3 text-[14px] whitespace-nowrap transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-text",
                  isActive
                    ? "border-accent font-bold text-text"
                    : "border-transparent text-muted hover:text-text",
                ].join(" ")}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
