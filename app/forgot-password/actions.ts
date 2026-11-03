"use server";

import { createClient } from "@/lib/db/server";

export type ResetRequestState = { sent: boolean; error: string | null; email: string };

// Always shows the same message, so the screen does not reveal which addresses exist
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { sent: false, error: "צריך למלא אימייל", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.APP_URL}/reset-password`,
  });
  // Rate limits and connection problems are worth telling; anything else looks like success
  if (error && (error.status === 429 || !error.status || error.status >= 500)) {
    console.error("reset password:", error.status, error.message);
    return {
      sent: false,
      error:
        error.status === 429
          ? "נשלחו יותר מדי בקשות. אפשר לנסות שוב בעוד כמה דקות."
          : "לא הצלחנו לשלוח כרגע. אפשר לנסות שוב בעוד רגע.",
      email,
    };
  }
  return { sent: true, error: null, email };
}
