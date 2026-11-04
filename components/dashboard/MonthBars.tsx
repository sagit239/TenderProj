import type { MonthCount } from "@/lib/dashboard";

const MAX_BAR_PX = 96;

// Simple column chart: the number above, the month below; no axes, grid or legend (DESIGN.md).
// The earliest month is on the right, in reading order. Labels take two lines (month, year), so 12 months fit a phone.
export function MonthBars({ title, months }: { title: string; months: MonthCount[] }) {
  const highest = Math.max(...months.map((m) => m.count), 1);
  const spoken = months.map((m) => `${m.label}: ${m.count}`).join(", ");

  return (
    <section className="min-w-0 rounded-card border border-line bg-white p-4 shadow-card">
      <h3 className="mb-3 text-h3 text-text">{title}</h3>
      <div role="img" aria-label={`${title}. ${spoken}`} className="flex gap-1">
        {months.map((m) => (
          <div key={m.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex h-[122px] w-full flex-col items-center justify-end">
              <span className="text-small text-text">{m.count}</span>
              {m.count > 0 && (
                <div
                  className="w-full max-w-7 rounded-t-[3px] bg-text"
                  style={{ height: `${Math.round((m.count / highest) * MAX_BAR_PX)}px` }}
                />
              )}
            </div>
            <span className="mt-1 text-center text-small text-muted">
              {m.label.split(" ").map((part) => (
                <span key={part} className="block">
                  {part}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
