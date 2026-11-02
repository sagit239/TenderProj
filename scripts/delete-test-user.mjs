// Deletes the test user created by create-test-user.mjs and removes .env.test.local.
// Run with: node --env-file=.env --env-file=.env.test.local scripts/delete-test-user.mjs
import { rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const id = process.env.TEST_USER_ID;
if (!id) {
  console.error("TEST_USER_ID is missing (.env.test.local not found?)");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { error } = await supabase.auth.admin.deleteUser(id);
if (error) {
  console.error("Could not delete test user:", error.message);
  process.exit(1);
}
rmSync(".env.test.local", { force: true });
console.log("Test user deleted.");
