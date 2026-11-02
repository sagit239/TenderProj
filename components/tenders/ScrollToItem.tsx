"use client";

import { useEffect } from "react";

// "מעבר לפריט" links end with #item-<id>. Rows exist twice (desktop table, mobile card),
// so scroll to the visible one and highlight it briefly. Remounted per tab (key).
export function ScrollToItem() {
  useEffect(() => {
    const id = window.location.hash.match(/^#item-(.+)$/)?.[1];
    if (!id) return;
    const el = [document.getElementById(`item-${id}`), document.getElementById(`item-m-${id}`)].find(
      (e) => e && e.offsetParent !== null,
    );
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("outline-2", "outline-offset-2", "outline-text");
    const timer = setTimeout(() => el.classList.remove("outline-2", "outline-offset-2", "outline-text"), 2500);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
