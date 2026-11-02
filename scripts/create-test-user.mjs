// Creates a separate test user in the Development project (for automated checks only)
// and writes its credentials to .env.test.local (ignored by git).
// Run with: node --env-file=.env scripts/create-test-user.mjs
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const email = `claude-test-${randomBytes(3).toString("hex")}@example.com`;
const password = randomBytes(12).toString("base64url");

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) {
  console.error("Could not create test user:", error.message);
  process.exit(1);
}

writeFileSync(
  ".env.test.local",
  `TEST_USER_ID=${data.user.id}\nTEST_USER_EMAIL=${email}\nTEST_USER_PASSWORD=${password}\n`,
);
console.log(`Test user created: ${email} (credentials saved to .env.test.local)`);
