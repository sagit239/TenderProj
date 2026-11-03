"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { saveNewPassword, type NewPasswordState } from "./actions";

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(saveNewPassword, {} as NewPasswordState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field id="password" label="סיסמה חדשה" error={state.password}>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          error={state.password}
          className="text-right"
        />
      </Field>
      <Field id="confirm" label="אימות סיסמה" error={state.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          error={state.confirm}
          className="text-right"
        />
      </Field>
      {state.form && (
        <p role="alert" className="text-small text-accent">
          {state.form}
        </p>
      )}
      <Button type="submit" variant="accent" disabled={pending} className="mt-2 w-full">
        {pending ? "שומרת…" : "שמירת הסיסמה"}
      </Button>
    </form>
  );
}
