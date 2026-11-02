"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { NavMenu } from "./NavMenu";
import { signOut } from "@/app/login/actions";
import { ToastProvider } from "@/components/ui/Toast";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Drawer: lock page scroll, close on Esc, move focus in and back out
  useEffect(() => {
    if (!drawerOpen) return;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      menuButton?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between bg-ink ps-1 pe-3 md:ps-4 md:pe-4">
        <div className="flex items-center gap-1">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="פתיחת התפריט"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            className="inline-flex size-11 items-center justify-center rounded-control text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/70 md:hidden"
          >
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-2 ps-2 md:ps-0">
            <span aria-hidden className="h-[18px] w-[3px] rounded-full bg-accent" />
            <span className="text-[15px] font-bold text-white">ניהול מכרזים</span>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-control px-2 text-[13px] text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-white/70 md:h-8"
          >
            התנתקות
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-[200px] shrink-0 bg-ink md:block">
          <div className="sticky top-12">
            <NavMenu />
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            aria-hidden
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/50 motion-safe:animate-fade-in"
          />
          <div
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="תפריט"
            className="absolute inset-y-0 right-0 flex w-[260px] max-w-[85vw] flex-col bg-ink shadow-dialog motion-safe:animate-drawer-in"
          >
            <div className="flex h-12 items-center justify-between ps-1 pe-3">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="סגירת התפריט"
                className="inline-flex size-11 items-center justify-center rounded-control text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/70"
              >
                <X size={22} strokeWidth={1.75} />
              </button>
            </div>
            <NavMenu onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
