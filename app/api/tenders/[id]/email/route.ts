import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { SEND_FAILURE_TEXT, isValidEmail, sendEmail } from "@/lib/email";
import { summaryEmail } from "@/lib/email/templates";

const MAX_RECIPIENTS = 20;
const MAX_BODY = 100_000;

// Sends the text edited in "שליחה במייל" (PRD F11). Nothing in the tender changes.
// One email per recipient: addresses stay private, and one bad address does not stop the rest (ADR-22).
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = (await request.json().catch(() => null)) as {
    subject?: unknown;
    body?: unknown;
    recipients?: unknown;
  } | null;
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  const recipients = Array.isArray(input?.recipients)
    ? [...new Set(input.recipients.filter((r): r is string => typeof r === "string").map((r) => r.trim().toLowerCase()))]
    : [];

  if (!subject || !body || body.length > MAX_BODY) {
    return NextResponse.json({ error: "חסרים נושא או תוכן למייל." }, { status: 400 });
  }
  if (recipients.length === 0) {
    return NextResponse.json({ error: "צריך לבחור לפחות נמען אחד." }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `אפשר לשלוח עד ${MAX_RECIPIENTS} נמענים בבת אחת.` }, { status: 400 });
  }
  const invalid = recipients.filter((r) => !isValidEmail(r));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `כתובת לא תקינה: ${invalid.map((r) => `⁦${r}⁩`).join(", ")}`, invalid }, { status: 400 });
  }

  // RLS: only a tender the signed-in user can see
  const { data: tender, error } = await supabase.from("tenders").select("id").eq("id", id).maybeSingle();
  if (error || !tender) return NextResponse.json({ error: "המכרז לא נמצא." }, { status: 404 });

  const results = await Promise.all(
    recipients.map(async (to) => ({ to, result: await sendEmail(summaryEmail(to, subject, body)) })),
  );
  const sent = results.filter((r) => r.result.ok).map((r) => r.to);
  const failed = results.flatMap((r) =>
    r.result.ok ? [] : [{ address: r.to, reason: SEND_FAILURE_TEXT[r.result.reason] }],
  );
  if (failed.length > 0) console.error("summary email failed", results.filter((r) => !r.result.ok));

  return NextResponse.json({ sent, failed }, { status: sent.length === 0 ? 502 : 200 });
}
