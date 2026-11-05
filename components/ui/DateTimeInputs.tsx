"use client";

import { useRef } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/Field";

// Text fields instead of the browser's date and time controls: those follow the computer's
// language (month first, AM/PM), while these are always dd/mm/yyyy and 24 hours.
// While typing, the value is the partial text; once complete it is YYYY-MM-DD or HH:MM.

export function isIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function typedDate(text: string) {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  const shown = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
  const iso = `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  return isIsoDate(iso) ? iso : shown;
}

function shownDate(value: string) {
  return isIsoDate(value) ? value.split("-").reverse().join("/") : value;
}

function typedTime(text: string) {
  // "9:30" means 09:30
  const padded = /^\d:/.test(text) ? `0${text}` : text;
  const digits = padded.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
};

export function DateInput({ id, value, onChange, onBlur, error }: Props) {
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Input
        id={id}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        placeholder="30/11/2026"
        value={shownDate(value)}
        onChange={(e) => onChange(typedDate(e.target.value))}
        onBlur={onBlur}
        error={error}
        className="pl-10 text-right"
      />
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={isIsoDate(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute start-auto end-0 top-0 h-full w-10 opacity-0"
      />
      <button
        type="button"
        aria-label="בחירה מלוח שנה"
        onClick={() => picker.current?.showPicker()}
        className="absolute end-1 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control text-muted hover:text-text"
      >
        <Calendar aria-hidden size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function TimeInput({ id, value, onChange, error }: Props) {
  // A whole hour can be typed short: 9 becomes 09:00
  function finish() {
    if (/^\d{1,2}$/.test(value)) {
      const full = `${value.padStart(2, "0")}:00`;
      if (isTime(full)) onChange(full);
    }
  }

  return (
    <Input
      id={id}
      dir="ltr"
      inputMode="numeric"
      autoComplete="off"
      placeholder="14:30"
      value={value}
      onChange={(e) => onChange(typedTime(e.target.value))}
      onBlur={finish}
      error={error}
      className="text-right"
    />
  );
}
