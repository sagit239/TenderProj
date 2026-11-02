"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/db/client";
import type { Role, TeamMember } from "@/lib/types";
import { TeamMemberDialog } from "./TeamMemberDialog";
import { DeleteMemberDialog } from "./DeleteMemberDialog";

type Props = {
  initialMembers: TeamMember[];
  initialRoles: Role[];
  loadFailed: boolean;
};

export function TeamList({ initialMembers, initialRoles, loadFailed }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [roles, setRoles] = useState(initialRoles);
  const [loadError, setLoadError] = useState(loadFailed);
  // undefined = closed, null = adding a new member, TeamMember = editing
  const [editing, setEditing] = useState<TeamMember | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<TeamMember | null>(null);

  const roleLabel = (key: string) => roles.find((r) => r.key === key)?.label ?? "";

  async function reload() {
    const supabase = createClient();
    const [m, r] = await Promise.all([
      supabase.from("team_members").select("id, name, role, email, created_at").order("created_at"),
      supabase.from("roles").select("key, label").order("sort_order"),
    ]);
    if (m.error || r.error) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    setMembers(m.data as TeamMember[]);
    setRoles(r.data as Role[]);
  }

  const addButton = (
    <Button variant="primary" onClick={() => setEditing(null)}>
      <Plus size={16} strokeWidth={2} aria-hidden />
      הוספת איש צוות
    </Button>
  );

  return (
    <>
      <PageHeader title="אנשי צוות" action={members.length > 0 ? addButton : undefined} />

      {loadError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-control bg-accent-tint px-4 py-2.5 text-accent"
        >
          <span>לא הצלחנו לטעון את רשימת אנשי הצוות.</span>
          <Button variant="ghost" size="sm" onClick={reload} className="text-accent hover:text-accent-dark">
            ניסיון חוזר
          </Button>
        </div>
      )}

      {members.length === 0 && !loadError && (
        <div className="rounded-card border border-line bg-white px-6 py-12 text-center shadow-card">
          <p className="mb-4 text-body text-muted">עדיין אין אנשי צוות. אפשר להוסיף את הראשון.</p>
          {addButton}
        </div>
      )}

      {members.length > 0 && (
        <>
          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-table border border-line bg-white md:block">
            <table className="w-full">
              <thead className="bg-table-head">
                <tr className="border-b border-line text-small text-muted">
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">שם</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">תפקיד</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">אימייל</th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">{m.name}</td>
                    <td className="px-4 py-2.5">{roleLabel(m.role)}</td>
                    <td className="px-4 py-2.5">
                      <span dir="ltr">{m.email}</span>
                    </td>
                    <td className="px-2 py-1.5 text-end whitespace-nowrap">
                      <RowActions member={m} onEdit={setEditing} onDelete={setDeleting} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per member */}
          <ul className="flex flex-col gap-2 md:hidden">
            {members.map((m) => (
              <li key={m.id} className="rounded-card border border-line bg-white p-4 shadow-card">
                <p className="text-h3">{m.name}</p>
                <dl className="mt-1 text-body">
                  <div className="flex gap-1">
                    <dt className="text-muted">תפקיד:</dt>
                    <dd>{roleLabel(m.role)}</dd>
                  </div>
                  <div className="flex min-w-0 gap-1">
                    <dt className="shrink-0 text-muted">אימייל:</dt>
                    <dd className="min-w-0 truncate" dir="ltr">
                      {m.email}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2 -ms-3 flex">
                  <RowActions member={m} onEdit={setEditing} onDelete={setDeleting} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <TeamMemberDialog
        open={editing !== undefined}
        member={editing ?? null}
        roles={roles}
        onClose={() => setEditing(undefined)}
        onSaved={async () => {
          setEditing(undefined);
          await reload();
        }}
      />
      <DeleteMemberDialog
        member={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={async () => {
          setDeleting(null);
          await reload();
        }}
      />
    </>
  );
}

function RowActions({
  member,
  onEdit,
  onDelete,
}: {
  member: TeamMember;
  onEdit: (m: TeamMember) => void;
  onDelete: (m: TeamMember) => void;
}) {
  return (
    <span className="inline-flex items-center text-muted">
      <Button variant="ghost" size="sm" onClick={() => onEdit(member)} aria-label={`עריכת ${member.name}`}>
        <Pencil size={14} strokeWidth={1.75} aria-hidden />
        עריכה
      </Button>
      <span aria-hidden>·</span>
      <Button variant="ghost" size="sm" onClick={() => onDelete(member)} aria-label={`מחיקת ${member.name}`}>
        <Trash2 size={14} strokeWidth={1.75} aria-hidden />
        מחיקה
      </Button>
    </span>
  );
}
