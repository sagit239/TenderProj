"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

type Props = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  // Returns false when the delete failed
  onConfirm: () => Promise<boolean>;
};

// Shared delete confirmation: "למחוק את <name>?", explanation, red "מחיקה" and "ביטול"
export function ConfirmDeleteDialog({ open, title, description, onClose, onConfirm }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (deleting) return;
    setError(null);
    onClose();
  }

  async function confirm() {
    setDeleting(true);
    setError(null);
    const ok = await onConfirm();
    setDeleting(false);
    if (!ok) setError("המחיקה לא הצליחה. אפשר לנסות שוב.");
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="accent" onClick={confirm} disabled={deleting}>
            {deleting ? "מוחקת…" : "מחיקה"}
          </Button>
          <Button variant="secondary" onClick={close} disabled={deleting}>
            ביטול
          </Button>
        </>
      }
    >
      <p className="text-body text-muted">{description}</p>
      {error && (
        <p role="alert" className="mt-3 rounded-control bg-accent-tint px-3 py-2 text-accent">
          {error}
        </p>
      )}
    </Dialog>
  );
}
