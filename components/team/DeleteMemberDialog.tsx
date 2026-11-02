"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { createClient } from "@/lib/db/client";
import type { TeamMember } from "@/lib/types";

type Props = {
  member: TeamMember | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteMemberDialog({ member, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!member) return;
    setDeleting(true);
    setError(null);
    const { error } = await createClient().from("team_members").delete().eq("id", member.id);
    setDeleting(false);
    if (error) {
      setError("המחיקה לא הצליחה. אפשר לנסות שוב.");
      return;
    }
    onDeleted();
  }

  return (
    <Dialog
      open={member !== null}
      onClose={close}
      title={member ? `למחוק את ${member.name} מרשימת אנשי הצוות?` : ""}
      footer={
        <>
          <Button variant="accent" onClick={confirm} disabled={deleting}>
            {deleting ? "מוחקת…" : "מחיקה"}
          </Button>
          <Button variant="secondary" onClick={close}>
            ביטול
          </Button>
        </>
      }
    >
      <p className="text-body text-muted">אי אפשר לבטל את הפעולה.</p>
      {error && (
        <p role="alert" className="mt-3 rounded-control bg-accent-tint px-3 py-2 text-accent">
          {error}
        </p>
      )}
    </Dialog>
  );
}
