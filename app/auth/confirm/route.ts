import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";

// The link in the password reset email lands here (ADR-21). Verifying the token signs the user
// in, then she continues to choose a new password. Works on any device, not only the one
// that asked for the reset.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = params.get("next") ?? "/reset-password";
  // Only paths inside the app
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/reset-password";

  const url = request.nextUrl.clone();
  url.search = "";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      url.pathname = safeNext;
      return NextResponse.redirect(url);
    }
  }

  url.pathname = "/forgot-password";
  url.search = "?error=expired";
  return NextResponse.redirect(url);
}
