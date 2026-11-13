/** What a row means for the household's money. Mirrors api/app/services/flows.py. */

import type { Account, Category, Txn } from "./api/types";

export type Flow = "spend" | "income" | "invest" | "withdraw";

export const SPENDING_TYPES = ["bank", "credit_card", "cash", "wallet"] as const;
export const INVESTMENT_TYPES = ["fd", "rd", "ppf", "epf", "nps", "mutual_fund", "stocks", "gold", "other_investment"] as const;

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  bank: "Bank account",
  credit_card: "Credit card",
  cash: "Cash",
  wallet: "Wallet / UPI",
  fd: "Fixed deposit",
  rd: "Recurring deposit",
  ppf: "PPF",
  epf: "EPF / VPF",
  nps: "NPS",
  mutual_fund: "Mutual funds",
  stocks: "Stocks",
  gold: "Gold",
  other_investment: "Other investment",
};

export const isInvestment = (type: string) => (INVESTMENT_TYPES as readonly string[]).includes(type);

type Lookup = { accounts: Map<string, Account>; categories: Map<string, Category> };

export function lookup(accounts: Account[], categories: Category[]): Lookup {
  return { accounts: new Map(accounts.map((a) => [a.id, a])), categories: new Map(categories.map((c) => [c.id, c])) };
}

export function flowOf(t: Txn & { transfer_id?: string | null }, l: Lookup): Flow | null {
  const inInvestment = isInvestment(l.accounts.get(t.account_id)?.type ?? "");
  const saving = !!t.category_id && l.categories.get(t.category_id)?.kind === "saving";
  const own = !t.transfer_id;
  if (t.direction === "debit") {
    if (inInvestment) return "withdraw";
    if (!own) return null;
    return saving ? "invest" : "spend";
  }
  if (inInvestment) return "invest";
  if (!own) return null;
  return saving ? "withdraw" : "income";
}
