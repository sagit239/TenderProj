import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "איפוס סיסמה · ניהול מכרזים",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthCard subtitle="איפוס סיסמה">
      <ForgotPasswordForm expired={error === "expired"} />
    </AuthCard>
  );
}
