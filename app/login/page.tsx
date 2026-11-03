import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "כניסה · ניהול מכרזים",
};

export default function LoginPage() {
  return (
    <AuthCard subtitle="כניסה למערכת">
      <LoginForm />
    </AuthCard>
  );
}
