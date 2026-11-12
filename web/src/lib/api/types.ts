export type Account = {
  id: string;
  name: string;
  type: string;
  institution: string;
  masked_number: string;
  opening_balance: number;
  balance: number;
};

export type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  kind: string;
  colour: string;
};

export type Txn = {
  id: string;
  account_id: string;
  amount: number; // paise
  direction: "debit" | "credit";
  occurred_at: string; // YYYY-MM-DD
  merchant: string;
  category_id: string | null;
  note: string;
  source: string;
  confidence?: number;
  needs_review?: boolean;
  dedupe_hash?: string;
  account_name?: string;
  category_name?: string;
};

export type Summary = { spent: number; income: number; net: number; count: number };

export type Rule = {
  id: string;
  pattern: string;
  category_id: string;
  category_name?: string | null;
  name: string;
  match_type: "contains" | "equals" | "regex";
  priority: number;
};

export type ImportRow = {
  id: string;
  batch_id?: string;
  line_no: number;
  occurred_at: string;
  description: string;
  merchant: string;
  direction: "debit" | "credit";
  amount: number;
  category_id: string | null;
  category_name?: string | null;
  confidence: number;
  reason: string;
  is_duplicate: boolean;
  status: "ready" | "review" | "duplicate" | "imported" | "skipped";
};

export type ImportBatch = {
  id: string;
  account_id: string;
  filename: string;
  status: "preview" | "committed";
  row_count: number;
  duplicate_count: number;
  review_count: number;
  imported_count: number;
  created_at?: string | null;
  mapping: Record<string, string>;
  warnings: string[];
};

export type ImportPreview = { batch: ImportBatch; rows: ImportRow[] };

export type ImportDecision = {
  row_id: string;
  action: "import" | "skip";
  category_id?: string | null;
};

export type ReviewRow = Txn & { suggested_category_id: string | null };
