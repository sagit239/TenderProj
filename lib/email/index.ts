import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// The only place that talks to Gmail (ARCHITECTURE: lib/email). Switching to another
// provider later means changing the transport here.

export type SendFailure = "invalid_address" | "rejected" | "other";

export type SendResult = { ok: true } | { ok: false; reason: SendFailure; detail: string };

export type Email = { to: string; subject: string; html: string; text: string };

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(address: string) {
  return ADDRESS.test(address.trim());
}

let transport: Transporter | null = null;

function getTransport() {
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transport;
}

// Sends from the project's Gmail account; replies go to the user (NOTIFY_EMAIL)
export async function sendEmail(email: Email): Promise<SendResult> {
  if (!isValidEmail(email.to)) {
    return { ok: false, reason: "invalid_address", detail: `invalid address: ${email.to}` };
  }
  try {
    const info = await getTransport().sendMail({
      from: { name: "ניהול מכרזים", address: process.env.GMAIL_USER! },
      to: email.to,
      replyTo: process.env.NOTIFY_EMAIL,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if ((info.rejected?.length ?? 0) > 0) {
      return { ok: false, reason: "rejected", detail: `rejected: ${String(info.response)}` };
    }
    return { ok: true };
  } catch (err) {
    const e = err as { code?: string; responseCode?: number; message?: string };
    // 5xx on the recipient or an envelope error: the server refused the address right away
    const rejected = e.code === "EENVELOPE" || (e.responseCode !== undefined && e.responseCode >= 500 && e.code !== "EAUTH");
    return {
      ok: false,
      reason: rejected ? "rejected" : "other",
      detail: `${e.code ?? "error"} ${e.responseCode ?? ""} ${e.message ?? String(err)}`.trim(),
    };
  }
}

export const SEND_FAILURE_TEXT: Record<SendFailure, string> = {
  invalid_address: "כתובת לא תקינה",
  rejected: "השרת דחה את הכתובת",
  other: "תקלה בשליחה",
};
