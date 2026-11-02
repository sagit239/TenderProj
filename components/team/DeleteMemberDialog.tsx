"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { createClient } from "@/lib/db/client";
import { ACTIVE_STATUSES } from "@/lib/tenders";
import type { TeamMember } from "@/lib/types";

// Open tasks of active tenders that the member is assigned to
async function countOpenTasks(memberId: string) {
  const { data, error } = await createClient()
    .from("task_assignees")
    .select("task_id, tasks!inner(is_done, tenders!inner(status))")
    .eq("team_member_id", memberId)
    .eq("tasks.is_done", false)
    .in("tasks.tenders.status", ACTIVE_STATUSES);
  return error ? 0 : data.length;
}

type Props = {
  member: TeamMember | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteMemberDialog({ member, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTasks, setOpenTasks] = useState<{ memberId: string; count: number } | null>(null);

  useEffect(() => {
    if (!member) return;
    let cancelled = false;
    countOpenTasks(member.id).then((count) => {
      if (!cancelled) setOpenTasks({ memberId: member.id, count });
    });
    return () => {
      cancelled = true;
    };
  }, [member]);

  const count = member && openTasks?.memberId === member.id ? openTasks.count : 0;

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
      {count > 0 && (
        <p role="alert" className="mb-3 rounded-control bg-accent-tint px-3 py-2 text-accent">
          {count === 1 ? "יש משימה פתוחה אחת" : `יש ${count} משימות פתוחות`} ששויכו לאיש הצוות הזה. אחרי המחיקה
          השיוך יוסר מהן, ומשימה שלא יישאר לה אחראי תוצג &quot;לא משויך&quot;.
        </p>
      )}
      <p className="text-body text-muted">אי אפשר לבטל את הפעולה.</p>
      {error && (
        <p role="alert" className="mt-3 rounded-control bg-accent-tint px-3 py-2 text-accent">
          {error}
        </p>
      )}
    </Dialog>
  );
}
