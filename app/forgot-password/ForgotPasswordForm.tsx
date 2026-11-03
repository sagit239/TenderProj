"use client";

import { useActionState } from "react";
import Link from "next/link";
import { authLinkClass } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { requestPasswordReset, type ResetRequestState } from "./actions";

const initialState: ResetRequestState = { sent: false, error: null, email: "" };

export function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {expired && !state.sent && (
        <p role="alert" className="rounded-control bg-accent-tint px-3 py-2.5 text-body text-accent">
          הקישור לאיפוס פג תוקף או כבר נוצל. אפשר לבקש קישור חדש.
        </p>
      )}
      <Field id="email" label="אימייל" error={state.error ?? undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder="name@example.com"
          defaultValue={state.email}
          error={state.error ?? undefined}
          className="text-right placeholder:text-right"
        />
      </Field>
      <Button type="submit" variant="accent" disabled={pending} className="mt-2 w-full">
        {pending ? "שולחת…" : "שליחת קישור לאיפוס"}
      </Button>
      {state.sent && (
        <p role="status" className="rounded-control bg-surface px-3 py-2.5 text-body text-text">
          אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה.
        </p>
      )}
      <div className="-mt-1 text-center">
        <Link href="/login" className={authLinkClass}>
          חזרה לכניסה
        </Link>
      </div>
    </form>
  );
}
