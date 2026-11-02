"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";

export type Member = { id: string; name: string };

type Props = {
  id: string;
  // Accessible name, e.g. "אחראים למשימה הכנת ערבות"
  label: string;
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
};

// "דנה כהן +1": the first chosen name and how many more
export function assigneesText(members: Member[], ids: string[]) {
  const names = members.filter((m) => ids.includes(m.id)).map((m) => m.name);
  if (names.length === 0) return null;
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

// Select-like button that opens a list of team members with a checkbox each.
// The list is positioned fixed, so it is not clipped by the rounded table wrapper.
export function AssigneePicker({ id, label, members, value, onChange, disabled, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const text = assigneesText(members, value);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    // RTL: align the list's right edge with the button's right edge, inside the viewport
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom;
    setPos({ top: below > 260 ? r.bottom + 4 : Math.max(8, r.top - 4 - Math.min(256, members.length * 44 + 16)), left, width });
  }, [open, members.length]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector("input")?.focus();
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggle(memberId: string, checked: boolean) {
    onChange(checked ? [...value, memberId] : value.filter((v) => v !== memberId));
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={`${label}: ${text ?? "לא משויך"}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative flex h-11 w-full items-center rounded-control border-[1.5px] border-input-border bg-white ps-3 pe-9 text-start text-[14px] outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-text focus-visible:ring-3 focus-visible:ring-text/10 disabled:cursor-not-allowed disabled:opacity-60 md:h-9 ${className}`}
      >
        <Chosen members={members} ids={value} />
        <ChevronDown aria-hidden size={16} strokeWidth={1.75} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
      </button>
      {open && pos && (
        <div
          ref={listRef}
          role="group"
          aria-label={label}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-50 max-h-64 overflow-y-auto rounded-control border border-line bg-white py-1 shadow-dialog motion-safe:animate-fade-in"
        >
          {members.length === 0 ? (
            <p className="px-3 py-2 text-small text-muted">אין אנשי צוות. אפשר להוסיף במסך &quot;אנשי צוות&quot;.</p>
          ) : (
            members.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-1 pe-3 hover:bg-surface md:ps-2">
                <Checkbox checked={value.includes(m.id)} onChange={(e) => toggle(m.id, e.target.checked)} aria-label={m.name} />
                <span className="py-2 text-[14px]">{m.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </>
  );
}

// The first name isolated from the "+N", so a name with Latin letters keeps its order
function Chosen({ members, ids }: { members: Member[]; ids: string[] }) {
  const names = members.filter((m) => ids.includes(m.id)).map((m) => m.name);
  if (names.length === 0) return <span className="truncate text-muted">לא משויך</span>;
  return (
    <span className="flex min-w-0 gap-1">
      <bdi className="truncate">{names[0]}</bdi>
      {names.length > 1 && <span dir="ltr" className="shrink-0">+{names.length - 1}</span>}
    </span>
  );
}
