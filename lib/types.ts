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

export type Requirement = { id: string; text: string; sort_order: number };

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

export type Task = {
  id: string;
  title: string;
  type: DeadlineType | "regular";
  due_at: string | null;
  has_time: boolean;
  sort_order: number;
};

export type Issue = {
  id: string;
  category: IssueCategory;
  title: string;
  explanation: string;
  source_refs: SourceRef[];
  suggested_question: string;
};
