/** Deep links into the ledger, so every derived number can open to the rows behind it. */

export type LedgerLink = {
  category?: string;
  direction?: "debit" | "credit";
  from?: string;
  to?: string;
  q?: string;
  tag?: string;
  view?: "review" | "uncategorised";
  account?: string;
  transfers?: "exclude";
  when?: "all";
};

const KEYS: (keyof LedgerLink)[] = ["category", "direction", "from", "to", "q", "tag", "view", "account", "transfers", "when"];

export function ledgerHref(link: LedgerLink = {}): string {
  const qs = new URLSearchParams();
  for (const key of KEYS) {
    const value = link[key];
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return `/ledger/${query ? `?${query}` : ""}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseLedgerLink(params: URLSearchParams): LedgerLink {
  const direction = params.get("direction");
  const view = params.get("view");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  return {
    category: params.get("category") || undefined,
    direction: direction === "debit" || direction === "credit" ? direction : undefined,
    from: ISO.test(from) ? from : undefined,
    to: ISO.test(to) ? to : undefined,
    q: params.get("q") || undefined,
    tag: params.get("tag") || undefined,
    view: view === "review" || view === "uncategorised" ? view : undefined,
    account: params.get("account") || undefined,
    transfers: params.get("transfers") === "exclude" ? "exclude" : undefined,
    when: params.get("when") === "all" ? "all" : undefined,
  };
}

/** Spending as the dashboard counts it: debits in the window, transfers excluded. */
export const spendLink = (from: string, to: string, extra: LedgerLink = {}): LedgerLink => ({
  direction: "debit",
  transfers: "exclude",
  from,
  to,
  ...extra,
});
