import "server-only";
import type { Email } from "@/lib/email";

// Hebrew, right-to-left emails with a plain-text version (ARCHITECTURE: lib/email)

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(body: string) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<body style="margin:0;padding:24px;background:#F5F5F6;font-family:Heebo,Arial,sans-serif;color:#1E1E21;direction:rtl;text-align:right">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E2E5;border-radius:12px;padding:24px">
    ${body}
  </div>
</body>
</html>`;
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:4px 0 4px 16px;color:#6E6E73;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`;

export type ReminderContent = {
  recipientName: string | null;
  tenderName: string;
  taskTitle: string;
  due: string | null;
};

// One reminder = one task only (PRD F7)
export function reminderEmail(to: string, c: ReminderContent): Email {
  const greeting = c.recipientName ? `שלום ${c.recipientName},` : "שלום,";
  const html = layout(`
    <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px">תזכורת למשימה במכרז:</p>
    <table style="border-collapse:collapse;margin:0 0 16px">
      ${row("מכרז", c.tenderName)}
      ${row("משימה", c.taskTitle)}
      ${c.due ? row("מועד", c.due) : ""}
    </table>
    <p style="margin:0;color:#6E6E73;font-size:13px">לשאלות אפשר להשיב למייל הזה.</p>`);
  const text = [
    greeting,
    "",
    "תזכורת למשימה במכרז:",
    `מכרז: ${c.tenderName}`,
    `משימה: ${c.taskTitle}`,
    ...(c.due ? [`מועד: ${c.due}`] : []),
    "",
    "לשאלות אפשר להשיב למייל הזה.",
  ].join("\n");
  return { to, subject: `תזכורת: ${c.taskTitle} · ${c.tenderName}`, html, text };
}

// The tender summary as edited in "שליחה במייל": the user's text as is, line breaks kept
export function summaryEmail(to: string, subject: string, body: string): Email {
  const html = layout(
    `<div style="line-height:1.6">${escapeHtml(body.trim()).replace(/\r?\n/g, "<br>")}</div>`,
  );
  return { to, subject, html, text: body.trim() };
}

export type FailedReminderLine ={ tenderName: string; taskTitle: string; recipient: string; reason: string };

// Sent to the user after a run in which reminders failed
export function failureAlertEmail(to: string, lines: FailedReminderLine[]): Email {
  const cell = "padding:6px 0 6px 12px;border-bottom:1px solid #E2E2E5;text-align:right";
  const rows = lines
    .map(
      (l) =>
        `<tr><td style="${cell}">${escapeHtml(l.tenderName)}</td><td style="${cell}">${escapeHtml(l.taskTitle)}</td><td style="${cell}" dir="ltr">${escapeHtml(l.recipient)}</td><td style="${cell}">${escapeHtml(l.reason)}</td></tr>`,
    )
    .join("");
  const head = (s: string) => `<th style="${cell};color:#6E6E73;font-weight:500">${s}</th>`;
  const html = layout(`
    <p style="margin:0 0 16px;color:#A3140F;font-weight:600">${lines.length === 1 ? "תזכורת אחת לא נשלחה" : `${lines.length} תזכורות לא נשלחו`}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr>${head("מכרז")}${head("משימה")}${head("נמען")}${head("סיבה")}</tr>
      ${rows}
    </table>
    <p style="margin:16px 0 0;color:#6E6E73;font-size:13px">אפשר לראות את הפרטים ולסמן כטופל במסך "מכרזים פעילים".</p>`);
  const text = [
    `${lines.length} תזכורות לא נשלחו:`,
    ...lines.map((l) => `- ${l.tenderName} · ${l.taskTitle} · ${l.recipient} · ${l.reason}`),
    "",
    'אפשר לראות את הפרטים ולסמן כטופל במסך "מכרזים פעילים".',
  ].join("\n");
  return { to, subject: `תזכורות לא נשלחו (${lines.length})`, html, text };
}
