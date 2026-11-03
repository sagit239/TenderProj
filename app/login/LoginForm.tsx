"use client";

import { useActionState } from "react";
import Link from "next/link";
import { authLinkClass } from "@/components/auth/AuthCard";
import { signIn, type SignInState } from "./actions";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const initialState: SignInState = { error: null, email: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field id="email" label="אימייל">
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder="name@example.com"
          defaultValue={state.email}
          className="text-right placeholder:text-right"
        />
      </Field>
      <Field id="password" label="סיסמה" error={state.error ?? undefined}>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          error={state.error ?? undefined}
          className="text-right"
        />
      </Field>
      <Button type="submit" variant="accent" disabled={pending} className="mt-2 w-full">
        {pending ? "מתחברת…" : "כניסה"}
      </Button>
      <div className="-mt-1 text-center">
        <Link href="/forgot-password" className={authLinkClass}>
          שכחתי סיסמה
        </Link>
      </div>
    </form>
  );
}
