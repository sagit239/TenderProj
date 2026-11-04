import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
} from "docx";
import { EMPTY_PART_TEXT, SUMMARY_PARTS } from "@/lib/summary";
import type { SummaryPart, TenderSummary } from "@/lib/types";

// Builds the Word file of the tender summary: Hebrew, right to left (ARCHITECTURE: ספריית docx).
// Every paragraph is bidirectional and every run is marked right-to-left.

const FONT = "Arial";
const MUTED = "6E6E73";
const LINE = "C9C9CD";

function run(text: string, options: Omit<IRunOptions, "text"> = {}) {
  return new TextRun({ text, rightToLeft: true, font: { ascii: FONT, cs: FONT, hAnsi: FONT }, ...options });
}

function para(runs: TextRun[], options: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bullet?: boolean; after?: number } = {}) {
  return new Paragraph({
    children: runs,
    bidirectional: true,
    alignment: AlignmentType.START,
    heading: options.heading,
    bullet: options.bullet ? { level: 0 } : undefined,
    spacing: { after: options.after ?? 80 },
  });
}

const text = (s: string, options: Omit<IRunOptions, "text"> = {}) => para([run(s, options)]);

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };

function table(head: string[], rows: string[][]) {
  const cell = (s: string, bold = false) =>
    new TableCell({
      children: [para([run(s, { bold, size: 20 })], { after: 0 })],
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h) => cell(h, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c) => cell(c)) })),
    ],
  });
}

function part(s: TenderSummary, key: SummaryPart): (Paragraph | Table)[] {
  const empty = [text(EMPTY_PART_TEXT, { color: MUTED })];
  if (key === "requirements") {
    return s.requirements.length > 0 ? s.requirements.map((r) => para([run(r)], { bullet: true })) : empty;
  }
  if (key === "deadlines") {
    return s.deadlines.length > 0
      ? [table(["מועד", "סוג", "תאריך", "אחראים", "מצב", "מקור"], s.deadlines.map((d) => [d.title, d.type, d.due, d.assignees, d.state, d.source]))]
      : empty;
  }
  if (key === "tasks") {
    return s.tasks.length > 0
      ? [table(["משימה", "מועד", "אחראים", "מצב"], s.tasks.map((t) => [t.title, t.due, t.assignees, t.state]))]
      : empty;
  }
  return s.issues.length > 0
    ? s.issues.flatMap((i) => [
        para([run(`${i.category} · `, { bold: true, color: "A3140F" }), run(i.title, { bold: true })], { after: 40 }),
        text(i.explanation),
        ...(i.source ? [text(`מקור: ${i.source}`, { color: MUTED, size: 20 })] : []),
        ...(i.question ? [para([run("שאלת הבהרה מוצעת: ", { bold: true }), run(i.question)], { after: 200 })] : []),
      ])
    : empty;
}

export async function buildSummaryDocx(s: TenderSummary): Promise<Buffer> {
  const exported = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", dateStyle: "short" }).format(new Date());
  const doc = new Document({
    creator: "ניהול מכרזים",
    title: s.name,
    styles: {
      default: {
        document: { run: { font: FONT, size: 22, rightToLeft: true } },
        // Style Guide text color instead of Word's default blue headings
        title: { run: { color: "1E1E21", bold: true, size: 40 } },
        heading1: { run: { color: "1E1E21", bold: true, size: 28 }, paragraph: { spacing: { before: 280 } } },
      },
    },
    sections: [
      {
        children: [
          para([run(s.name)], { heading: HeadingLevel.TITLE, after: 120 }),
          text(`${s.department} · ${s.status} · יוצא ב-${exported}`, { color: MUTED }),
          ...SUMMARY_PARTS.flatMap((p) => [para([run(p.label)], { heading: HeadingLevel.HEADING_1, after: 120 }), ...part(s, p.key)]),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
