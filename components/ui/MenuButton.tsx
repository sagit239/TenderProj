"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type MenuItem = { label: string; icon?: ReactNode; danger?: boolean; onSelect: () => void };

type Props = {
  // Content of the trigger button (text and/or icon)
  children: ReactNode;
  // Accessible name when the trigger shows only an icon
  label?: string;
  buttonClassName: string;
  className?: string;
  items: MenuItem[];
};

// Button with a small menu under it; closes on Esc or an outside click and returns focus to the button
export function MenuButton({ children, label, buttonClassName, className = "", items }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClassName}
      >
        {children}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-20 mt-1 min-w-[160px] rounded-control border border-line bg-white py-1 shadow-dialog motion-safe:animate-fade-in"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={i === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={[
                "flex h-11 w-full items-center gap-2 px-3 text-start text-[14px] font-medium focus-visible:outline-none md:h-9",
                item.danger
                  ? "text-accent hover:bg-accent-tint focus-visible:bg-accent-tint"
                  : "text-text hover:bg-surface focus-visible:bg-surface",
              ].join(" ")}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
