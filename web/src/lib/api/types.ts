export type Account = {
  id: string;
  name: string;
  type: string;
  institution: string;
  masked_number: string;
  opening_balance: number;
  balance: number;
  kind?: "spending" | "investment";
  description?: string;
  interest_rate?: number | null;
  maturity_date?: string | null;
  monthly_amount?: number | null;
  current_value?: number | null;
  value_as_of?: string | null;
  value?: number;
  gain?: number | null;
  contributed_this_period?: number;
};

export type AccountInput = Partial<
  Pick<
    Account,
    | "name"
    | "type"
    | "institution"
    | "masked_number"
    | "opening_balance"
    | "description"
    | "interest_rate"
    | "maturity_date"
    | "monthly_amount"
    | "current_value"
  >
>;

export type PeriodFlow = {
  period_start: string;
  period_end: string;
  label: string;
  income: number;
  spent: number;
  invested: number;
  withdrawn: number;
  saved: number;
  savings_rate: number | null;
  invest_rate: number | null;
};

export type MoneySummary = {
  periods: PeriodFlow[];
  income_by_source: GroupRow[];
  invested_by_type: GroupRow[];
  net_worth: number;
  liquid: number;
  investments: number;
  owed: number;
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
  tags?: string[];
  source: string;
  confidence?: number;
  needs_review?: boolean;
  dedupe_hash?: string;
  import_batch_id?: string;
  created_at?: string;
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
  fixed?: boolean;
  is_active: boolean;
};

export type BudgetStatus = {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  parent_id: string | null;
  scope: "overall" | "group" | "category";
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
  fixed: boolean;
  category_kind: string | null;
  days_left: number;
  daily_allowance: number;
  projected: number | null;
};

export type BudgetSuggestion = { category_id: string | null; average: number; periods: number };

export type Household = { id: string; name: string; currency: string; cycle_start_day: number };

export type TransactionPatch = { category_id?: string | null; note?: string; tags?: string[]; merchant?: string };

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
  invested: number;
  savings_due: number;
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

export type Count = { count: number; out: number; income: number; net: number };

export type TransactionDetail = {
  id: string;
  account_id: string;
  account_name: string | null;
  amount: number;
  direction: "debit" | "credit";
  occurred_at: string;
  merchant: string;
  note: string;
  tags: string[];
  category_id: string | null;
  category_name: string | null;
  category_parent: string | null;
  source: string;
  confidence: number;
  needs_review: boolean;
  transfer_id: string | null;
  dedupe_hash: string | null;
  created_at: string | null;
  import_filename: string | null;
  import_batch_id: string | null;
};
