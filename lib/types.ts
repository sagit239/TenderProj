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
