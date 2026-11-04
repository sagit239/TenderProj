"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { getEmailDraft, type EmailDraft } from "@/app/(app)/tenders/[id]/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { SummaryPart, Tender } from "@/lib/types";

// Same order and labels as lib/summary SUMMARY_PARTS (that file is server-only)
const PARTS: { key: SummaryPart; label: string }[] = [
  { key: "requirements", label: "סיכום דרישות" },
  { key: "deadlines", label: "לוח זמנים" },
  { key: "tasks", label: "משימות" },
  { key: "issues", label: "סעיפים בעייתיים" },
];

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keeps an address left-to-right inside a Hebrew sentence (Unicode LTR isolate)
const ltr = (s: string) => `⁦${s}⁩`;

type Recipient = { address: string; name: string | null };

function composeBody(draft: EmailDraft, parts: SummaryPart[]) {
  return ["שלום רב,", ...PARTS.filter((p) => parts.includes(p.key)).map((p) => draft.parts[p.key])].join("\n\n");
}

// "שליחה במייל": choose parts, edit the text, pick recipients (PRD F11). The edit affects this email only.
export function EmailDialog({ open, onClose, tender }: { open: boolean; onClose: () => void; tender: Tender }) {
  const [sending, setSending] = useState(false);
  return (
    <Dialog open={open} onClose={sending ? () => {} : onClose} title="שליחה במייל" wide>
      <EmailForm tender={tender} onClose={onClose} sending={sending} setSending={setSending} />
    </Dialog>
  );
}

function EmailForm({
  tender,
  onClose,
  sending,
  setSending,
}: {
  tender: Tender;
  onClose: () => void;
  sending: boolean;
  setSending: (v: boolean) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<EmailDraft | null | "loading">("loading");
  const [parts, setParts] = useState<SummaryPart[]>(PARTS.map((p) => p.key));
  const [subject, setSubject] = useState(`סיכום מכרז: ${tender.name}`);
  const [body, setBody] = useState("");
  const [edited, setEdited] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEmailDraft(tender.id).then((d) => {
      if (cancelled) return;
      setDraft(d);
      if (d) setBody(composeBody(d, PARTS.map((p) => p.key)));
    });
    return () => {
      cancelled = true;
    };
  }, [tender.id]);

  if (draft === "loading") return <p className="py-8 text-center text-body text-muted">טוען…</p>;
  if (!draft) {
    return (
      <p role="alert" className="py-8 text-center text-body text-accent">
        לא הצלחנו לטעון את סיכום המכרז. אפשר לסגור את החלון ולנסות שוב.
      </p>
    );
  }
  const loaded = draft;

  function toggle(part: SummaryPart, checked: boolean) {
    const next = checked ? [...parts, part] : parts.filter((p) => p !== part);
    setParts(next);
    setBody(composeBody(loaded, next));
    setEdited(false);
  }

  function addRecipient(address: string, name: string | null = null) {
    const clean = address.trim().replace(/[,;]+$/, "");
    if (!clean) return;
    setError(null);
    setRecipients((list) =>
      list.some((r) => r.address.toLowerCase() === clean.toLowerCase()) ? list : [...list, { address: clean, name }],
    );
  }

  function onTypedKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      addRecipient(typed);
      setTyped("");
    } else if (e.key === "Backspace" && !typed && recipients.length > 0) {
      setRecipients((list) => list.slice(0, -1));
    }
  }

  // A typed address that was not confirmed with Enter still counts
  const all = typed.trim() ? [...recipients, { address: typed.trim(), name: null }] : recipients;
  const invalid = all.filter((r) => !ADDRESS.test(r.address));
  const available = loaded.members.filter((m) => !recipients.some((r) => r.address.toLowerCase() === m.email.toLowerCase()));

  async function send() {
    if (invalid.length > 0) {
      setError(`כתובת לא תקינה: ${invalid.map((r) => ltr(r.address)).join(", ")}`);
      return;
    }
    if (all.length === 0) {
      setError("צריך לבחור לפחות נמען אחד.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenders/${tender.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, recipients: all.map((r) => r.address) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sent?: string[];
        failed?: { address: string; reason: string }[];
      };
      if (!res.ok && !data.sent?.length) {
        setError(data.error ?? "המייל לא נשלח. אפשר לנסות שוב.");
        toast("המייל לא נשלח. אפשר לנסות שוב.", "error");
        return;
      }
      const sent = data.sent?.length ?? 0;
      const failed = data.failed ?? [];
      if (failed.length > 0) {
        // Keep only the recipients that failed, so a retry does not send twice
        setRecipients(all.filter((r) => failed.some((f) => f.address === r.address.toLowerCase())));
        setTyped("");
        setError(`לא נשלח ל: ${failed.map((f) => `${ltr(f.address)} (${f.reason})`).join(", ")}`);
        toast(`המייל נשלח ל-${sent} נמענים. חלק מהנמענים לא קיבלו אותו.`, "error");
        return;
      }
      toast(sent === 1 ? "המייל נשלח לנמען אחד" : `המייל נשלח ל-${sent} נמענים`);
      onClose();
    } catch {
      setError("המייל לא נשלח. אפשר לנסות שוב.");
      toast("המייל לא נשלח. אפשר לנסות שוב.", "error");
    } finally {
      setSending(false);
    }
  }

  const canSend = !sending && subject.trim() !== "" && body.trim() !== "" && all.length > 0;

  return (
    <div className="flex flex-col gap-4 pb-3">
      <fieldset>
        <legend className="mb-1 text-[13px] leading-[18px] font-semibold text-text">מה לשלוח</legend>
        <div className="flex flex-wrap gap-x-4">
          {PARTS.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-center gap-1 text-body">
              <Checkbox checked={parts.includes(p.key)} onChange={(e) => toggle(p.key, e.target.checked)} />
              {p.label}
            </label>
          ))}
        </div>
        {edited && <p className="mt-1 text-small text-muted">שינוי החלקים יחליף את הטקסט שערכת.</p>}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email-recipient-input" className="text-[13px] leading-[18px] font-semibold text-text">
          נמענים
        </label>
        <div
          className={[
            "flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border-[1.5px] bg-white px-2 py-1.5 focus-within:ring-3 md:min-h-10",
            error ? "border-accent focus-within:ring-accent/15" : "border-input-border focus-within:border-text focus-within:ring-text/10",
          ].join(" ")}
        >
          {recipients.map((r) => {
            const bad = !ADDRESS.test(r.address);
            return (
              <span
                key={r.address}
                className={`inline-flex max-w-full items-center gap-1 rounded-tag border px-2 py-0.5 text-[13px] ${bad ? "border-accent bg-accent-tint text-accent" : "border-line bg-surface text-text"}`}
              >
                {r.name ? (
                  <span className="truncate">{r.name}</span>
                ) : (
                  <span dir="ltr" className="truncate">
                    {r.address}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setRecipients((list) => list.filter((x) => x !== r))}
                  aria-label={`הסרת ${r.name ?? r.address}`}
                  className="-me-1 inline-flex size-6 items-center justify-center rounded-tag hover:bg-line focus-visible:outline-2 focus-visible:outline-text"
                >
                  <X size={14} strokeWidth={1.75} aria-hidden />
                </button>
              </span>
            );
          })}
          <input
            id="email-recipient-input"
            type="text"
            inputMode="email"
            autoComplete="off"
            dir="ltr"
            value={typed}
            onChange={(e) => {
              // Pasted lists ("a@x.com, b@y.com") become separate tags; the last piece stays in the field
              const pieces = e.target.value.split(/[,;\s]+/);
              pieces.slice(0, -1).forEach((p) => addRecipient(p));
              setTyped(pieces[pieces.length - 1]);
              setError(null);
            }}
            onKeyDown={onTypedKey}
            onBlur={() => {
              if (typed.trim()) {
                addRecipient(typed);
                setTyped("");
              }
            }}
            placeholder="name@example.com"
            aria-describedby="email-recipient-hint"
            className="h-8 min-w-[160px] flex-1 bg-transparent px-1 text-[14px] text-start outline-none placeholder:text-muted/70"
          />
        </div>
        <p id="email-recipient-hint" className="text-small text-muted">
          אפשר להקליד כתובת וללחוץ Enter, או לבחור מאנשי הצוות.
        </p>
        {available.length > 0 && (
          <div className="md:w-[280px]">
            <label htmlFor="email-member" className="sr-only">
              הוספת איש צוות
            </label>
            <Select
              id="email-member"
              value=""
              onChange={(e) => {
                const m = loaded.members.find((x) => x.id === e.target.value);
                if (m) addRecipient(m.email, m.name);
              }}
            >
              <option value="">+ הוספה מאנשי הצוות</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.email}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <Field id="email-subject" label="נושא">
        <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>

      <Field id="email-body" label="תוכן המייל (אפשר לערוך)">
        <textarea
          id="email-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setEdited(true);
          }}
          rows={12}
          className="min-h-[240px] w-full rounded-control border-[1.5px] border-input-border bg-white px-3 py-2 text-[14px] leading-[22px] text-text outline-none transition-[border-color,box-shadow] duration-150 focus:border-text focus:ring-3 focus:ring-text/10"
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-control bg-accent-tint px-3 py-2 text-body text-accent">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="accent" onClick={send} disabled={!canSend}>
          {sending ? "שולח…" : "שליחה"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={sending}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
