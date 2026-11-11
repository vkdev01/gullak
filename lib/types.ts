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
  account_name?: string;
  category_name?: string;
};

export type Summary = { spent: number; income: number; net: number; count: number };
