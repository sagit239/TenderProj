import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client for background work with no user session (the AI analysis).
// Bypasses RLS, so it must never reach the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
