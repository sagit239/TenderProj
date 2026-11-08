"use client";

import { useEffect } from "react";

const HIGHLIGHT = ["outline-2", "outline-offset-2", "outline-text", "bg-surface"];

// Scrolls to an item row and highlights it for a few seconds. Rows exist twice (desktop table,
// mobile card), so the visible one is used. A row that is not on the page yet (right after
// saving, before the refresh) is waited for, up to about 4 seconds.
export function highlightItem(id: string, tries = 40) {
  const el = [document.getElementById(`item-${id}`), document.getElementById(`item-m-${id}`)].find(
    (e) => e && e.offsetParent !== null,
  );
  if (!el) {
    if (tries > 0) setTimeout(() => highlightItem(id, tries - 1), 100);
    return;
  }
  el.scrollIntoView({ block: "center" });
  el.classList.add(...HIGHLIGHT);
  setTimeout(() => el.classList.remove(...HIGHLIGHT), 4000);
}

// "מעבר לפריט" and "הצגה" links end with #item-<id>. Remounted per tab (key).
export function ScrollToItem() {
  useEffect(() => {
    const id = window.location.hash.match(/^#item-(.+)$/)?.[1];
    if (id) highlightItem(id);
  }, []);
  return null;
}
