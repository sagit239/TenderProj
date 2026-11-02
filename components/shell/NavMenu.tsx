"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Check, List, Plus, Users, type LucideIcon } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/tenders", label: "מכרזים פעילים", icon: List },
  { href: "/archive", label: "ארכיון", icon: Archive },
  { href: "/submitted", label: "הוגשו", icon: Check },
  { href: "/team", label: "אנשי צוות", icon: Users },
];

// "+ New tender" button and the four nav items; shared by the sidebar and the mobile drawer
export function NavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="תפריט ראשי" className="flex flex-col gap-4 px-3 py-4">
      <Link
        href="/tenders/new"
        onClick={onNavigate}
        className={`${buttonClasses("accent", "md")} w-full`}
      >
        <Plus size={16} strokeWidth={2} aria-hidden />
        מכרז חדש
      </Link>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/tenders"
              ? pathname === "/tenders" || pathname.startsWith("/tenders/")
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex h-11 items-center gap-2.5 rounded-control border-s-[3px] px-3 text-[14px] transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70",
                  active
                    ? "border-accent bg-ink-active font-semibold text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
