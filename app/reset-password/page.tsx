import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata: Metadata = {
  title: "סיסמה חדשה · ניהול מכרזים",
};

// Reached from the reset email through /auth/confirm, already signed in (the proxy checks)
export default function ResetPasswordPage() {
  return (
    <AuthCard subtitle="בחירת סיסמה חדשה">
      <NewPasswordForm />
    </AuthCard>
  );
}
