"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

export type SignInState = {
  error: string | null;
  email: string;
};

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "צריך למלא אימייל וסיסמה", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 400 = wrong email or password; anything else is a connection/server problem
    const wrongCredentials =
      error.code === "invalid_credentials" || error.status === 400;
    return {
      error: wrongCredentials
        ? "האימייל או הסיסמה שגויים, אפשר לנסות שוב"
        : "לא הצלחנו להתחבר כרגע. אפשר לנסות שוב בעוד רגע.",
      email,
    };
  }

  redirect("/tenders");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
