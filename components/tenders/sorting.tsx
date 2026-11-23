"use client";

// Sorting by column in the tender tabs. The choice lives only while the tab is open.
import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { thClass } from "./TabParts";

type SortValue = string | number | null;

// null values always come last
export type SortColumn<T> = { key: string; label: string; value: (item: T) => SortValue };

export type Sorting = {
  columns: { key: string; label: string }[];
  key: string | null;
  desc: boolean;
  // Sorts by the column, or reverses when it is already the sorted one
  toggle: (key: string) => void;
  choose: (key: string | null) => void;
  flip: () => void;
};

const collator = new Intl.Collator("he", { numeric: true });

function compare(a: SortValue, b: SortValue, desc: boolean) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const order = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
  return desc ? -order : order;
}

// Without a chosen column, the items keep their regular order
export function useSort<T>(items: T[], columns: SortColumn<T>[]): { sorted: T[]; sorting: Sorting } {
  const [key, setKey] = useState<string | null>(null);
  const [desc, setDesc] = useState(false);
  const column = columns.find((c) => c.key === key);
  const sorted = column ? [...items].sort((a, b) => compare(column.value(a), column.value(b), desc)) : items;

  function choose(next: string | null) {
    setKey(next);
    setDesc(false);
  }
  const flip = () => setDesc((d) => !d);
  const toggle = (next: string) => (next === key ? flip() : choose(next));

  return { sorted, sorting: { columns, key, desc, toggle, choose, flip } };
}

// A table header that sorts: the label is a button, with ▲ / ▼ on the sorted column
export function SortTh({
  sorting,
  column,
  className = thClass,
}: {
  sorting: Sorting;
  column: string;
  className?: string;
}) {
  const active = sorting.key === column;
  return (
    <th scope="col" aria-sort={active ? (sorting.desc ? "descending" : "ascending") : undefined} className={className}>
      <button
        type="button"
        onClick={() => sorting.toggle(column)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-tag whitespace-nowrap hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        {sorting.columns.find((c) => c.key === column)?.label}
        <span aria-hidden className={`text-[9px] ${active ? "text-text" : "invisible"}`}>
          {active && sorting.desc ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

// "מיון לפי" above the cards (below 1280px, where there are no table headers)
export function SortSelect({ sorting, id }: { sorting: Sorting; id: string }) {
  const flipLabel = sorting.desc ? "היפוך הסדר (עכשיו בסדר יורד)" : "היפוך הסדר (עכשיו בסדר עולה)";
  return (
    <div className="mb-3 flex items-center gap-2 xl:hidden">
      <label htmlFor={id} className="shrink-0 text-small text-muted">
        מיון לפי
      </label>
      <div className="min-w-0 flex-1 md:max-w-56">
        <Select id={id} value={sorting.key ?? ""} onChange={(e) => sorting.choose(e.target.value || null)}>
          <option value="">סדר רגיל</option>
          {sorting.columns.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={sorting.key === null}
        onClick={sorting.flip}
        aria-label={flipLabel}
        title="היפוך הסדר"
      >
        <ArrowDownUp size={16} strokeWidth={1.75} aria-hidden />
      </Button>
    </div>
  );
}
