export type Role = {
  key: string;
  label: string;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  email: string;
  created_at: string;
};

export type Department = "medical" | "safety";

export type TenderStatus =
  | "reviewing"
  | "preparing"
  | "not_bidding"
  | "submitted"
  | "won"
  | "lost";

export type Tender = {
  id: string;
  name: string;
  department: Department;
  status: TenderStatus;
  decided_at: string | null;
  submitted_at: string | null;
  created_at: string;
};

export type FileType = "pdf" | "word" | "excel";

export type TenderDocument = {
  id: string;
  tender_id: string;
  file_name: string;
  storage_path: string;
  file_type: FileType;
  created_at: string;
};

export type AnalysisStatus = "idle" | "running" | "done" | "failed";

export type TenderAnalysis = {
  analysis_status: AnalysisStatus;
  analysis_started_at: string | null;
};

export type ReadWarning = "partial" | "unreadable";

export type DocumentReadState = {
  read_warning: ReadWarning | null;
  read_note: string | null;
  analyzed_at: string | null;
};

export type SourceRef = { file_name: string; page: number | null; section: string | null };

export type DeadlineType =
  | "submission"
  | "bidders_meeting"
  | "clarification_questions"
  | "closing_meeting"
  | "other";

export type IssueCategory =
  | "threshold"
  | "guarantees"
  | "penalties"
  | "liability"
  | "insurance"
  | "payment_terms"
  | "one_sided"
  | "contradictions";

export type Requirement = { id: string; text: string; sort_order: number; is_manual: boolean };

export type Deadline = {
  id: string;
  type: DeadlineType;
  title: string;
  due_at: string;
  has_time: boolean;
  source_refs: SourceRef[];
  is_manual: boolean;
  is_auto: boolean;
};

export type TaskType = DeadlineType | "regular";

export type Task = {
  id: string;
  deadline_id: string | null;
  title: string;
  type: TaskType;
  due_at: string | null;
  has_time: boolean;
  is_done: boolean;
  remind_at: string | null;
  // "ללא תזכורת"
  reminders_off: boolean;
  is_manual: boolean;
  sort_order: number;
  assignee_ids: string[];
};

// A reminder that failed to send and is not yet marked as handled ("תזכורות שלא נשלחו")
export type FailedReminder = {
  id: string;
  tender_name: string;
  task_title: string;
  recipient_email: string | null;
  error: string | null;
};

export type Issue = {
  id: string;
  category: IssueCategory;
  title: string;
  explanation: string;
  source_refs: SourceRef[];
  suggested_question: string;
  is_manual: boolean;
  sort_order: number;
};

export type ItemType = "requirement" | "deadline" | "task" | "issue";

export type ProposalStatus = "pending" | "accepted" | "rejected";

// Payload is the item as the AI returned it (see lib/ai/schema.ts)
export type AnalysisProposal = {
  id: string;
  run_id: string;
  item_type: ItemType;
  payload: Record<string, unknown>;
  status: ProposalStatus;
  sort_order: number;
};

export type MissingItem = { item_type: ItemType; item_id: string; label: string };

export type ChangeReport = {
  added: { requirements: number; deadlines: number; tasks: number; issues: number };
  missing: MissingItem[];
};

// A finished re-analysis, listed under "דוחות שינויים"
export type ReanalysisRun = {
  id: string;
  finished_at: string;
  change_report: ChangeReport | null;
  pending: number;
};

// The four parts of the tender summary (export and "שליחה במייל")
export type SummaryPart = "requirements" | "deadlines" | "tasks" | "issues";

// The summary with display-ready text, shared by Word, the print page and the email draft
export type TenderSummary = {
  id: string;
  name: string;
  department: string;
  status: string;
  requirements: string[];
  deadlines: { type: string; title: string; due: string; assignees: string; state: string; source: string }[];
  tasks: { title: string; due: string; assignees: string; state: string }[];
  issues: { category: string; title: string; explanation: string; source: string; question: string }[];
};
