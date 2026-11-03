// Sends the reminders that are due, by calling the local endpoint (Development has no cron).
// Run with: npm run reminders:run  (loads .env, so the secret never appears in the terminal)
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is missing in .env");
  process.exit(1);
}

const url = `${process.env.APP_URL || "http://localhost:3000"}/api/cron/reminders`;
try {
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  console.log(`${res.status} ${await res.text()}`);
  if (!res.ok) process.exit(1);
} catch (err) {
  console.error(`Could not reach ${url}. Is "npm run dev" running?`, err.message);
  process.exit(1);
}
