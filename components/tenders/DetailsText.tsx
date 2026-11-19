import { Fragment } from "react";

// Links, emails and Israeli phone numbers inside a task's details line
const PATTERN =
  /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|((?:\+972[-\s]?|0)\d{1,2}[-\s]?\d{3}[-\s]?\d{4}|\*\d{4})/g;

const linkClass = "text-text underline underline-offset-2";

// Trailing punctuation is part of the sentence, not of the link
function splitTrailing(url: string) {
  const m = url.match(/[.,;:)\]]+$/);
  return m ? [url.slice(0, -m[0].length), m[0]] : [url, ""];
}

function Linked({ line }: { line: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(PATTERN)) {
    const start = m.index ?? 0;
    if (start > last) out.push(line.slice(last, start));
    const [url, email, phone] = [m[1], m[2], m[3]];
    if (url) {
      const [href, rest] = splitTrailing(url);
      out.push(
        <a key={start} href={href.startsWith("www.") ? `https://${href}` : href} target="_blank" rel="noopener noreferrer" dir="ltr" className={`${linkClass} break-all`}>
          {href}
        </a>,
        rest,
      );
    } else if (email) {
      out.push(
        <a key={start} href={`mailto:${email}`} dir="ltr" className={`${linkClass} break-all`}>
          {email}
        </a>,
      );
    } else if (phone) {
      out.push(
        <a key={start} href={`tel:${phone.replace(/[-\s]/g, "")}`} dir="ltr" className={`${linkClass} whitespace-nowrap`}>
          {phone}
        </a>,
      );
    }
    last = start + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return <>{out}</>;
}

// The details line under a task's name (ADR-33): muted, one row per line, links clickable
export function DetailsText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return (
    <p className={`text-small text-muted ${className}`}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <Linked line={line} />
        </Fragment>
      ))}
    </p>
  );
}
