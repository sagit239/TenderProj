"use client";

import { Copy } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function CopyButton({ text }: { text: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={`${buttonClasses("secondary", "sm")} shrink-0 self-start`}
      onClick={async () => {
        if (await copy(text)) toast("ההעתקה הצליחה");
        else toast("ההעתקה לא הצליחה. אפשר לסמן את הטקסט ולהעתיק ידנית.", "error");
      }}
    >
      <Copy size={14} strokeWidth={1.75} aria-hidden />
      העתקה
    </button>
  );
}

// Clipboard API first; some embedded browsers block it, so fall back to a hidden textarea
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
