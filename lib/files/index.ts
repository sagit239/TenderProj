import mammoth from "mammoth";
import { PDFDocument } from "pdf-lib";
import WordExtractor from "word-extractor";
import * as XLSX from "xlsx";

export type FileKind = "pdf" | "word" | "excel";

// A file ready for the AI: PDFs go as-is (the model reads text + page images),
// Word/Excel are converted to plain text here
export type LoadedFile =
  | { ok: true; name: string; kind: "pdf"; data: Buffer }
  | { ok: true; name: string; kind: "text"; text: string }
  | { ok: false; name: string; note: string };

// Never throws: a broken or protected file becomes { ok: false } with a short Hebrew note
export async function convertFile(name: string, kind: FileKind, data: Buffer): Promise<LoadedFile> {
  try {
    if (kind === "pdf") {
      // Parse locally first: one broken PDF would make OpenAI reject the whole request
      const pdf = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
      if (pdf.isEncrypted) return { ok: false, name, note: "הקובץ מוגן בסיסמה" };
      if (pdf.getPageCount() === 0) return { ok: false, name, note: "הקובץ פגום ולא ניתן לקרוא אותו" };
      return { ok: true, name, kind: "pdf", data };
    }

    const text = kind === "word" ? await wordToText(name, data) : excelToText(data);
    if (!text.trim()) return { ok: false, name, note: "לא נמצא טקסט בקובץ" };
    return { ok: true, name, kind: "text", text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const encrypted = /encrypt|password/i.test(message);
    return {
      ok: false,
      name,
      note: encrypted ? "הקובץ מוגן בסיסמה" : "הקובץ פגום ולא ניתן לקרוא אותו",
    };
  }
}

async function wordToText(name: string, data: Buffer): Promise<string> {
  if (name.toLowerCase().endsWith(".doc")) {
    const doc = await new WordExtractor().extract(data);
    return doc.getBody();
  }
  // Go through HTML to keep headings and list items, which the model uses for section references
  const { value: html } = await mammoth.convertToHtml({ buffer: data });
  return htmlToText(html);
}

function htmlToText(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>/g, (_, level) => "\n" + "#".repeat(Number(level)) + " ")
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/(p|h[1-6]|tr)>|<br\s*\/?>/g, "\n")
    .replace(/<\/t[dh]>/g, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function excelToText(data: Buffer): string {
  const book = XLSX.read(data, { type: "buffer" });
  return book.SheetNames.map((sheet) => {
    const csv = XLSX.utils.sheet_to_csv(book.Sheets[sheet], { blankrows: false });
    return `=== גיליון: ${sheet} ===\n${csv}`;
  }).join("\n\n");
}
