import { formatSourceRef } from "@/lib/analysis";
import type { Original, SourceRef, TaskType } from "@/lib/types";
import { Sources } from "./TabParts";

// A requirement or a task (only a task has a type)
type Item = { source_refs: SourceRef[]; is_manual: boolean; original: Original; type?: TaskType };

// The text for an item without references: added by hand, or from an analysis before sources were
// kept. is_manual alone is not enough: it is also set when an analysed item is edited (ADR-34).
function withoutRefs(x: Item) {
  if (x.type === "closing_meeting" && !x.is_manual) return "אוטומטי (3 ימי עבודה לפני ההגשה)";
  return x.is_manual && x.original === null ? "ידני" : null;
}

// "מקור" of a requirement or a task
export function ItemSource({ item }: { item: Item }) {
  if (item.source_refs.length > 0) return <Sources refs={item.source_refs} />;
  return <>{withoutRefs(item) ?? "—"}</>;
}

// For sorting; null (nothing to show) goes last
export function itemSourceText(x: Item) {
  return x.source_refs.length > 0 ? x.source_refs.map(formatSourceRef).join(" / ") : withoutRefs(x);
}
