// Applies new files in supabase/migrations/ to the Development database.
// Run with: npm run db:migrate  (loads .env, so secrets never appear in the terminal)
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL is missing in .env");
  process.exit(1);
}

// Run the Supabase CLI through node directly (no shell, so the URL is passed safely)
const require = createRequire(import.meta.url);
const cli = require.resolve("supabase/dist/supabase.js");
const result = spawnSync(
  process.execPath,
  [cli, "db", "push", "--db-url", dbUrl, "--include-all", "--yes"],
  { stdio: "inherit" },
);
if (result.status !== 0) {
  console.error("Migration failed.");
  process.exit(result.status ?? 1);
}

// Show what is recorded in app_migrations (service role bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const { data, error } = await supabase
  .from("app_migrations")
  .select("name, applied_at")
  .order("name");
if (error) {
  console.error("Could not read app_migrations:", error.message);
  process.exit(1);
}
console.log("\napp_migrations:");
for (const row of data) console.log(`  ${row.name}  (${row.applied_at})`);
