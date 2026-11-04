"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

export type NewPasswordState = { password?: string; confirm?: string; form?: string };

const MIN_LENGTH = 8;

export async function saveNewPassword(
  _prev: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const errors: NewPasswordState = {
    password: password.length >= MIN_LENGTH ? undefined : `הסיסמה צריכה להיות באורך ${MIN_LENGTH} תווים לפחות`,
    confirm: !confirm ? "צריך להקליד את הסיסמה שוב" : confirm !== password ? "הסיסמאות לא תואמות" : undefined,
  };
  if (errors.password || errors.confirm) return errors;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/forgot-password?error=expired");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return { password: "זו הסיסמה הנוכחית. צריך לבחור סיסמה אחרת." };
    }
    if (error.code === "weak_password") {
      return { password: "הסיסמה חלשה מדי. כדאי לבחור סיסמה ארוכה יותר, עם אותיות ומספרים." };
    }
    console.error("update password:", error.code, error.message);
    return { form: "לא הצלחנו לשמור את הסיסמה. אפשר לנסות שוב בעוד רגע." };
  }

  redirect("/dashboard");
}
