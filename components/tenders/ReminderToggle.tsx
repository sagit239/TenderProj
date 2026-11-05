"use client";

type Props = {
  on: boolean;
  label: string;
  // The timing, or why nothing is sent; shown under the buttons
  note: string | null;
  muted: boolean;
  onChange: (on: boolean) => void;
};

const OPTIONS = [
  { value: true, text: "עם תזכורת" },
  { value: false, text: "ללא תזכורת" },
];

// Two small buttons, so the chosen state reads at a glance
export function ReminderToggle({ on, label, note, muted, onChange }: Props) {
  return (
    <div className="flex w-fit flex-col gap-1">
      <div role="group" aria-label={label} className="flex overflow-hidden rounded-control border border-input-border">
        {OPTIONS.map((o) => (
          <button
            key={o.text}
            type="button"
            aria-pressed={on === o.value}
            onClick={() => on !== o.value && onChange(o.value)}
            className={`h-11 cursor-pointer whitespace-nowrap px-2.5 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text md:h-8 ${
              on === o.value ? "bg-text font-semibold text-white" : "bg-white text-muted hover:text-text"
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
      {note && <span className={`text-small ${muted ? "text-muted" : ""}`}>{note}</span>}
    </div>
  );
}
