"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { createClient } from "@/lib/db/client";
import type { Role, TeamMember } from "@/lib/types";

// Select value that reveals the "new role" field
const NEW_ROLE = "__new__";

type Values = { name: string; role: string; newRole: string; email: string };
type Errors = Partial<Record<keyof Values, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(field: keyof Values, values: Values): string | undefined {
  const v = values[field].trim();
  if (field === "name" && !v) return "צריך למלא שם";
  if (field === "role" && !v) return "צריך לבחור תפקיד";
  if (field === "newRole" && values.role === NEW_ROLE && !v) return "צריך לכתוב את שם התפקיד";
  if (field === "email") {
    if (!v) return "צריך למלא אימייל";
    if (!EMAIL_RE.test(v)) return "כתובת האימייל לא נראית תקינה, למשל name@example.com";
  }
  return undefined;
}

type Props = {
  open: boolean;
  member: TeamMember | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
};

export function TeamMemberDialog({ open, member, roles, onClose, onSaved }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={member ? "עריכת איש צוות" : "הוספת איש צוות"}>
      {/* Remount the form on every open, so it starts from fresh values */}
      {open && (
        <MemberForm
          key={member?.id ?? "new"}
          member={member}
          roles={roles}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function MemberForm({
  member,
  roles,
  onClose,
  onSaved,
}: {
  member: TeamMember | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Values>({
    name: member?.name ?? "",
    role: member?.role ?? "",
    newRole: "",
    email: member?.email ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function update(field: keyof Values, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    // Clear an existing error as soon as the value becomes valid
    if (errors[field] && !validate(field, next)) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function blur(field: keyof Values) {
    setErrors((prev) => ({ ...prev, [field]: validate(field, values) }));
  }

  // Returns the key of the role to save: an existing one, or a newly created one
  async function resolveRoleKey(): Promise<string | null> {
    if (values.role !== NEW_ROLE) return values.role;
    const label = values.newRole.trim();
    const existing = roles.find((r) => r.label === label);
    if (existing) return existing.key;
    const { data, error } = await createClient()
      .from("roles")
      .insert({ label })
      .select("key")
      .single();
    return error ? null : data.key;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {
      name: validate("name", values),
      role: validate("role", values),
      newRole: validate("newRole", values),
      email: validate("email", values),
    };
    setErrors(next);
    if (next.name || next.role || next.newRole || next.email) return;

    setSaving(true);
    setSaveError(null);
    const roleKey = await resolveRoleKey();
    if (!roleKey) {
      setSaving(false);
      setSaveError("השמירה לא הצליחה. אפשר לנסות שוב.");
      return;
    }
    const row = {
      name: values.name.trim(),
      role: roleKey,
      email: values.email.trim(),
    };
    const supabase = createClient();
    const { error } = member
      ? await supabase.from("team_members").update(row).eq("id", member.id)
      : await supabase.from("team_members").insert(row);
    setSaving(false);

    if (error) {
      setSaveError("השמירה לא הצליחה. אפשר לנסות שוב.");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-1">
      <Field id="member-name" label="שם" error={errors.name}>
        <Input
          id="member-name"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          onBlur={() => blur("name")}
          error={errors.name}
          autoComplete="off"
        />
      </Field>
      <Field id="member-role" label="תפקיד" error={errors.role}>
        <Select
          id="member-role"
          value={values.role}
          onChange={(e) => update("role", e.target.value)}
          onBlur={() => blur("role")}
          error={errors.role}
        >
          <option value="" disabled>
            בחירת תפקיד
          </option>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
          <option value={NEW_ROLE}>+ תפקיד חדש…</option>
        </Select>
      </Field>
      {values.role === NEW_ROLE && (
        <Field
          id="member-new-role"
          label="שם התפקיד החדש"
          error={errors.newRole}
          hint="התפקיד יתווסף לרשימה ויהיה זמין גם לאנשי צוות אחרים"
        >
          <Input
            id="member-new-role"
            value={values.newRole}
            onChange={(e) => update("newRole", e.target.value)}
            onBlur={() => blur("newRole")}
            error={errors.newRole}
            autoComplete="off"
            autoFocus
          />
        </Field>
      )}
      <Field id="member-email" label="אימייל" error={errors.email}>
        <Input
          id="member-email"
          type="email"
          dir="ltr"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          onBlur={() => blur("email")}
          error={errors.email}
          placeholder="name@example.com"
          autoComplete="off"
          className="text-right placeholder:text-right"
        />
      </Field>

      {saveError && (
        <p role="alert" className="rounded-control bg-accent-tint px-3 py-2 text-accent">
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-2 pb-3">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "שומרת…" : "שמירה"}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
