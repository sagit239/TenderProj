// JSON Schema for the model's answer (Structured Outputs, strict mode),
// plus the matching TypeScript types

export const DEADLINE_TYPES = [
  "submission",
  "bidders_meeting",
  "clarification_questions",
  "other",
] as const;

export const ISSUE_CATEGORIES = [
  "threshold",
  "guarantees",
  "penalties",
  "liability",
  "insurance",
  "payment_terms",
  "one_sided",
  "contradictions",
] as const;

export type DeadlineType = (typeof DEADLINE_TYPES)[number];
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export type AiSourceRef = { file_name: string; page: number | null; section: string | null };

export type AiResult = {
  requirements: { text: string }[];
  deadlines: {
    key: string;
    type: DeadlineType;
    title: string;
    date: string;
    time: string | null;
    source_refs: AiSourceRef[];
  }[];
  tasks: { title: string; deadline_key: string | null; date: string | null; time: string | null }[];
  issues: {
    category: IssueCategory;
    title: string;
    explanation: string;
    source_refs: AiSourceRef[];
    suggested_question: string;
  }[];
  documents: { file_name: string; read_quality: "full" | "partial" | "none"; note: string | null }[];
};

const nullableString = { type: ["string", "null"] };

const sourceRef = {
  type: "object",
  additionalProperties: false,
  required: ["file_name", "page", "section"],
  properties: {
    file_name: { type: "string" },
    page: { type: ["integer", "null"] },
    section: nullableString,
  },
};

function arrayOf(properties: Record<string, unknown>) {
  return {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(properties),
      properties,
    },
  };
}

export const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["requirements", "deadlines", "tasks", "issues", "documents"],
  properties: {
    requirements: arrayOf({ text: { type: "string" } }),
    deadlines: arrayOf({
      key: { type: "string" },
      type: { type: "string", enum: DEADLINE_TYPES },
      title: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      time: { ...nullableString, description: "HH:MM (24h), or null if no time is stated" },
      source_refs: { type: "array", items: sourceRef },
    }),
    tasks: arrayOf({
      title: { type: "string" },
      deadline_key: nullableString,
      date: { ...nullableString, description: "YYYY-MM-DD" },
      time: { ...nullableString, description: "HH:MM (24h)" },
    }),
    issues: arrayOf({
      category: { type: "string", enum: ISSUE_CATEGORIES },
      title: { type: "string" },
      explanation: { type: "string" },
      source_refs: { type: "array", items: sourceRef },
      suggested_question: { type: "string" },
    }),
    documents: arrayOf({
      file_name: { type: "string" },
      read_quality: { type: "string", enum: ["full", "partial", "none"] },
      note: nullableString,
    }),
  },
};

// Re-analysis: only new items, plus the short ids of existing items no longer found
export type AiReanalysisResult = AiResult & { missing_ids: string[] };

export const REANALYSIS_SCHEMA = {
  ...RESULT_SCHEMA,
  required: [...RESULT_SCHEMA.required, "missing_ids"],
  properties: {
    ...RESULT_SCHEMA.properties,
    missing_ids: { type: "array", items: { type: "string" } },
  },
};
