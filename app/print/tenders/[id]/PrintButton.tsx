"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Opens the browser's print dialog on load when asked to (?auto=1, from "PDF (הדפסה)"), and again on click
export function PrintButton({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    // Let fonts finish loading so the PDF uses Heebo
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, [auto]);

  return (
    <Button onClick={() => window.print()}>
      <Printer size={16} strokeWidth={1.75} aria-hidden />
      הדפסה / שמירה כ-PDF
    </Button>
  );
}
