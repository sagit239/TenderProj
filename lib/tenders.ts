import type { Department, FileType, Tender, TenderStatus } from "@/lib/types";

export const DEPARTMENTS: { key: Department; label: string }[] = [
  { key: "medical", label: "רפואי" },
  { key: "safety", label: "בטיחות" },
];

export const STATUSES: { key: TenderStatus; label: string }[] = [
  { key: "reviewing", label: "בבדיקה" },
  { key: "preparing", label: "ניגשים – בהכנה" },
  { key: "not_bidding", label: "לא ניגשים" },
  { key: "submitted", label: "הוגש" },
  { key: "won", label: "זכינו" },
  { key: "lost", label: "לא זכינו" },
];

export const departmentLabel = (d: Department) =>
  DEPARTMENTS.find((x) => x.key === d)?.label ?? "";

export const statusLabel = (s: TenderStatus) =>
  STATUSES.find((x) => x.key === s)?.label ?? "";

export function isDepartment(value: unknown): value is Department {
  return value === "medical" || value === "safety";
}

// Which list a tender belongs to; the lists are filtered views of one table
export type TenderList = "active" | "archive" | "submitted";

export const ACTIVE_STATUSES: TenderStatus[] = ["reviewing", "preparing"];
export const ARCHIVE_STATUSES: TenderStatus[] = ["not_bidding"];
export const SUBMITTED_STATUSES: TenderStatus[] = ["submitted", "won", "lost"];

export function listForStatus(status: TenderStatus): TenderList {
  if (ARCHIVE_STATUSES.includes(status)) return "archive";
  if (SUBMITTED_STATUSES.includes(status)) return "submitted";
  return "active";
}

export function isTenderList(value: unknown): value is TenderList {
  return value === "active" || value === "archive" || value === "submitted";
}

export const LIST_LABELS: Record<TenderList, string> = {
  active: "מכרזים פעילים",
  archive: "ארכיון",
  submitted: "מכרזים שהוגשו",
};

export function listHref(list: TenderList, tender?: Pick<Tender, "department">) {
  if (list === "archive") return "/archive";
  if (list === "submitted") {
    return tender ? `/submitted?dept=${tender.department}` : "/submitted";
  }
  return "/tenders";
}

export function tenderHref(id: string, from: TenderList, tab?: string) {
  const params = new URLSearchParams({ from });
  if (tab) params.set("tab", tab);
  return `/tenders/${id}?${params}`;
}

// Private Storage bucket for the original tender files
export const BUCKET = "tender-files";

// Supported upload formats (F3) and the Storage per-file limit
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx";

const EXTENSION_TYPES: Record<string, FileType> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
};

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  pdf: "PDF",
  word: "Word",
  excel: "Excel",
};

export function fileExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function fileTypeFromName(name: string): FileType | null {
  return EXTENSION_TYPES[fileExtension(name)] ?? null;
}

// Returns an error message for a file that cannot be uploaded, or null
export function fileProblem(file: File): string | null {
  if (!fileTypeFromName(file.name)) {
    return `הקובץ ${file.name} לא נתמך. אפשר להעלות PDF, Word או Excel.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `הקובץ ${file.name} גדול מ-50MB.`;
  }
  return null;
}

// Storage keys must be ASCII, so the original (Hebrew) name lives only in the table
export function storagePath(tenderId: string, documentId: string, fileName: string) {
  return `${tenderId}/${documentId}.${fileExtension(fileName)}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// dd/mm/yyyy in Israel time
export function formatDate(iso: string | null) {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}
