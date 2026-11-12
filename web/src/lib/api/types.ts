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

export type Budget = {
  id: string;
  name: string;
  category_id: string | null;
  period: string;
  amount: number;
  rollover: boolean;
  is_active: boolean;
};

export type BudgetStatus = {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  period_start: string;
  period_end: string;
  allocated: number;
  carried: number;
  spent: number;
  remaining: number;
  used_pct: number;
  elapsed_pct: number;
  status: "on_track" | "at_risk" | "over";
  rollover: boolean;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  contributed: number;
  progress_pct: number;
  monthly_target: number | null;
  target_date: string | null;
  projected_finish: string | null;
  status: string;
};

export type Insight = {
  kind: string;
  severity: string;
  title: string;
  fact_pack: Record<string, unknown>;
};

export type DueSoon = { merchant: string; amount: number; due: string; cadence: string };

export type Dashboard = {
  period_start: string;
  period_end: string;
  period_label: string;
  days_left: number;
  elapsed_pct: number;
  income: number;
  spent: number;
  committed: number;
  budgeted_remaining: number;
  free_to_spend: number;
  budgets: BudgetStatus[];
  goals: Goal[];
  due_soon: DueSoon[];
  sparkline: { date: string; amount: number }[];
  insights: Insight[];
};

export type Series = {
  merchant: string;
  cadence: string;
  occurrences: number;
  expected_amount: number;
  last_seen: string;
  next_due: string;
  is_subscription: boolean;
  price_change: number;
};

export type GroupRow = { key: string; label: string; total: number; count: number };
