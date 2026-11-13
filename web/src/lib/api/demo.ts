/**
 * Demo transport for the static build (GitHub Pages).
 *
 * When NEXT_PUBLIC_API_URL is not set, the app runs entirely in the browser
 * against localStorage so the static export is usable without a server.
 * It mirrors the FastAPI contract in backend/ — same shapes, same rules —
 * and is deliberately not a substitute for it: no auth, no real isolation.
 */
import { buildCandidates, dedupeHash, type Mapping } from "../csv";
import { matchMerchant } from "../merchants";
import { detectSeries } from "../recurring";
import { daysBetween, elapsedFraction, periodBounds, periodLabel, previousPeriod, toISO } from "../plan";
import { budgetScope, categoryScope, paceStatus, projectedSpend, reservedByBudgets } from "../budgets";
import { flowOf, isInvestment, lookup, type Flow } from "../flows";
import { normaliseTags } from "../tags";
import type {
  Account,
  AccountInput,
  Budget,
  BudgetStatus,
  BudgetSuggestion,
  Category,
  Dashboard,
  Goal,
  GroupRow,
  Household,
  MoneySummary,
  ImportBatch,
  ImportDecision,
  ImportPreview,
  ImportRow,
  ReviewRow,
  Rule,
  Summary,
  TransactionPatch,
  Txn,
} from "./types";

const KEY = "gullak.static.v2";
const REVIEW_THRESHOLD = 0.7;

type DB = {
  household: { id: string; name: string; currency: string; cycle_start_day: number };
  accounts: Account[];
  categories: Category[];
  transactions: Txn[];
  rules: Rule[];
  batches: ImportBatch[];
  rows: ImportRow[];
  budgets: Budget[];
  goals: (Goal & { contributions: { amount: number; on: string }[] })[];
};

const uid = () => "id-" + Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const DEFAULT_CATS: Record<string, string[]> = {
  "Food & drink": ["Groceries", "Dining", "Delivery", "Coffee"],
  Housing: ["Rent", "Electricity", "Internet", "Maintenance"],
  Transport: ["Cab", "Fuel", "Train", "Metro", "Vehicle service", "Parking & tolls"],
  Shopping: ["Clothing", "Electronics", "Home"],
  Health: ["Pharmacy", "Doctor", "Fitness"],
  Entertainment: ["Subscriptions", "Movies", "Events"],
  "Loans & EMIs": ["Vehicle loan", "Home loan", "Personal loan"],
  Money: ["Fees", "Interest", "Insurance"],
  Other: ["Miscellaneous", "Gifts", "Education", "Personal care"],
  "Savings & investments": [
    "Mutual funds / SIP",
    "Stocks",
    "Fixed deposit",
    "Recurring deposit",
    "PPF",
    "EPF / VPF",
    "NPS",
    "Gold",
  ],
  Income: ["Salary", "Bonus", "Freelance", "Interest earned", "Dividends", "Rental income", "Refund"],
};
const KINDS: Record<string, string> = { Income: "income", "Savings & investments": "saving" };

const MERCHANTS: [string, string, number, [number, number]][] = [
  ["Swiggy", "Dining", 1, [180, 620]],
  ["Zomato", "Dining", 1, [200, 700]],
  ["Blinkit", "Groceries", 2, [240, 1400]],
  ["Zepto", "Groceries", 1, [200, 1200]],
  ["BigBasket", "Groceries", 2, [900, 3800]],
  ["DMart", "Groceries", 1, [1200, 4200]],
  ["Third Wave Coffee", "Coffee", 1, [140, 420]],
  ["Blue Tokai", "Coffee", 1, [180, 520]],
  ["Uber", "Cab", 2, [90, 480]],
  ["Ola", "Cab", 1, [80, 420]],
  ["Netflix", "Subscriptions", 0, [649, 649]],
  ["Hotstar", "Subscriptions", 0, [299, 299]],
  ["Spotify", "Subscriptions", 0, [119, 119]],
  ["Cult.fit", "Fitness", 0, [1499, 1499]],
  ["Apollo Pharmacy", "Pharmacy", 1, [120, 900]],
  ["Amazon", "Electronics", 2, [300, 4500]],
  ["Myntra", "Clothing", 1, [600, 3200]],
  ["Jio", "Internet", 0, [799, 799]],
  ["IRCTC", "Train", 0, [450, 1800]],
];

function blank(): DB {
  const hid = uid();
  const cats: Category[] = [];
  Object.entries(DEFAULT_CATS).forEach(([parent, kids], i) => {
    const pid = uid();
    const colour = ["green", "clay", "butter"][i % 3];
    const kind = KINDS[parent] ?? "expense";
    cats.push({ id: pid, parent_id: null, name: parent, kind, colour });
    kids.forEach((k) => cats.push({ id: uid(), parent_id: pid, name: k, kind, colour }));
  });
  return {
    household: { id: hid, name: "Demo household", currency: "INR", cycle_start_day: 1 },
    accounts: [
      { id: uid(), name: "HDFC Savings", type: "bank", institution: "HDFC", masked_number: "8842", opening_balance: 4_250_000, balance: 4_250_000 },
      { id: uid(), name: "HDFC Credit Card", type: "credit_card", institution: "HDFC", masked_number: "4412", opening_balance: 0, balance: 0 },
      { id: uid(), name: "Cash", type: "cash", institution: "", masked_number: "", opening_balance: 4_000_000, balance: 4_000_000 },
    ],
    categories: cats,
    transactions: [],
    rules: [],
    batches: [],
    rows: [],
    budgets: [],
    goals: [],
  };
}

let cache: DB | null = null;

/**
 * A store written by an older build is not a valid store: MVP 1 shipped
 * `rules`/`batches`/`rows` but no `budgets`/`goals`, and MVP 0 had no
 * `cycle_start_day`. Rather than crash on the first read, merge what exists
 * over a fresh store so every key the code touches is present.
 */
function migrate(stored: Partial<DB> | null | undefined): DB {
  const base = blank();
  const household = { ...base.household, ...(stored?.household ?? {}) };
  const anchor = Number(household.cycle_start_day);
  household.cycle_start_day = Number.isFinite(anchor) && anchor >= 1 && anchor <= 28 ? Math.floor(anchor) : 1;

  return {
    household,
    accounts: Array.isArray(stored?.accounts) && stored!.accounts!.length ? stored!.accounts! : base.accounts,
    categories: Array.isArray(stored?.categories) && stored!.categories!.length ? stored!.categories! : base.categories,
    transactions: stored?.transactions ?? [],
    rules: stored?.rules ?? [],
    batches: stored?.batches ?? [],
    rows: stored?.rows ?? [],
    budgets: stored?.budgets ?? [],
    goals: stored?.goals ?? [],
  };
}

function db(): DB {
  if (cache) return cache;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (raw) {
      cache = migrate(JSON.parse(raw) as Partial<DB>);
      persist();
      return cache;
    }
  } catch {
    // A corrupt store is not worth a broken app: start clean.
  }
  cache = blank();
  persist();
  return cache;
}

function persist() {
  if (typeof window !== "undefined" && cache) window.localStorage.setItem(KEY, JSON.stringify(cache));
}

const catName = (id: string | null) => (id ? db().categories.find((c) => c.id === id)?.name : undefined);
const acctName = (id: string) => db().accounts.find((a) => a.id === id)?.name;

function withNames(t: Txn): Txn {
  return { ...t, account_name: acctName(t.account_id), category_name: catName(t.category_id) };
}

function recalc() {
  const d = db();
  d.accounts = d.accounts.map((a) => ({
    ...a,
    balance:
      a.opening_balance +
      d.transactions
        .filter((t) => t.account_id === a.id)
        .reduce((s, t) => s + (t.direction === "credit" ? t.amount : -t.amount), 0),
  }));
}

/** Rows of one flow inside a window, by the same rules as api/app/services/flows.py. */
function flowRows(flow: Flow, from?: string, to?: string): Txn[] {
  const d = db();
  const l = lookup(d.accounts, d.categories);
  return d.transactions.filter(
    (t) => flowOf(t, l) === flow && (!from || t.occurred_at >= from) && (!to || t.occurred_at <= to),
  );
}

const sum = (rows: Txn[]) => rows.reduce((s, t) => s + t.amount, 0);

/** Recompute a goal's totals and finish date from its contributions. */
function refreshGoal(goal: DB["goals"][number]) {
  goal.contributed = goal.contributions.reduce((s, c) => s + c.amount, 0);
  goal.progress_pct = Math.round((goal.contributed / goal.target) * 1000) / 10;
  goal.projected_finish = null;
  if (goal.monthly_target) {
    const months = Math.ceil(Math.max(goal.target - goal.contributed, 0) / goal.monthly_target);
    const finish = new Date();
    finish.setMonth(finish.getMonth() + months);
    goal.projected_finish = toISO(finish);
  }
  persist();
  return goal;
}

function currentPeriod() {
  return periodBounds(db().household.cycle_start_day, new Date());
}

function describeAccount(a: Account): Account {
  const investment = isInvestment(a.type);
  const { start, end } = currentPeriod();
  const value = investment && a.current_value != null ? a.current_value : a.balance;
  return {
    ...a,
    kind: investment ? "investment" : "spending",
    value,
    gain: investment && a.current_value != null ? value - a.balance : null,
    contributed_this_period: investment
      ? sum(
          db().transactions.filter(
            (t) => t.account_id === a.id && t.direction === "credit" && t.occurred_at >= start && t.occurred_at <= end,
          ),
        )
      : 0,
  };
}

function savingsDue(start: string, end: string): number {
  return db()
    .accounts.filter((a) => isInvestment(a.type) && (a.monthly_amount ?? 0) > 0)
    .reduce((due, a) => {
      const paid = sum(
        db().transactions.filter(
          (t) => t.account_id === a.id && t.direction === "credit" && t.occurred_at >= start && t.occurred_at <= end,
        ),
      );
      return due + Math.max((a.monthly_amount ?? 0) - paid, 0);
    }, 0);
}

export const demo = {
  signup: (email: string, _password: string, name: string) => {
    const d = db();
    d.household.name = `${name.split(" ")[0]}'s household`;
    persist();
    return { access_token: "demo-token" };
  },
  login: (_email: string, _password: string) => ({ access_token: "demo-token" }),
  me: () => ({ id: "demo-user", name: "Demo user", email: "demo@example.com", household_id: db().household.id }),

  accounts: () => {
    recalc();
    return db().accounts.filter((a) => !a.archived).map(describeAccount);
  },
  createAccount: (body: AccountInput) => {
    if (!body.name?.trim()) throw new Error("name: an account needs a name");
    const a: Account = {
      id: uid(),
      name: body.name.trim(),
      type: body.type ?? "bank",
      institution: body.institution ?? "",
      masked_number: body.masked_number ?? "",
      opening_balance: body.opening_balance ?? 0,
      balance: body.opening_balance ?? 0,
      description: body.description ?? "",
      interest_rate: body.interest_rate ?? null,
      maturity_date: body.maturity_date ?? null,
      monthly_amount: body.monthly_amount ?? null,
      current_value: body.current_value ?? null,
      value_as_of: body.current_value != null ? todayISO() : null,
    };
    db().accounts.push(a);
    persist();
    return describeAccount(a);
  },
  updateAccount: (id: string, body: AccountInput) => {
    const a = db().accounts.find((x) => x.id === id);
    if (!a) throw new Error("Account not found");
    Object.assign(a, body);
    if ("current_value" in body) a.value_as_of = body.current_value != null ? todayISO() : null;
    persist();
    recalc();
    return describeAccount(db().accounts.find((x) => x.id === id)!);
  },
  transfer: (body: { from_account_id: string; to_account_id: string; amount: number; occurred_at: string; note?: string }) => {
    const d = db();
    if (body.from_account_id === body.to_account_id) throw new Error("Pick two different accounts");
    const from = d.accounts.find((a) => a.id === body.from_account_id);
    const to = d.accounts.find((a) => a.id === body.to_account_id);
    if (!from || !to) throw new Error("Account not found in this household");
    const transfer_id = uid();
    const leg = (account: Account, direction: "debit" | "credit", merchant: string) =>
      ({
        id: uid(),
        account_id: account.id,
        amount: body.amount,
        direction,
        occurred_at: body.occurred_at,
        merchant,
        category_id: null,
        note: body.note ?? "",
        tags: [],
        source: "manual",
        transfer_id,
      }) as Txn;
    const out = leg(from, "debit", `Transfer to ${to.name}`);
    const into = leg(to, "credit", `Transfer from ${from.name}`);
    d.transactions.push(out, into);
    persist();
    recalc();
    return { transfer_id, from_transaction_id: out.id, to_transaction_id: into.id };
  },
  moneySummary: (periods = 6): MoneySummary => {
    const d = db();
    const anchor = d.household.cycle_start_day;
    const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
    const history = [];
    let window = currentPeriod();
    for (let i = 0; i < periods; i++) {
      const income = sum(flowRows("income", window.start, window.end));
      const spent = sum(flowRows("spend", window.start, window.end));
      const invested = sum(flowRows("invest", window.start, window.end));
      history.push({
        period_start: window.start,
        period_end: window.end,
        label: periodLabel(window.start, window.end),
        income,
        spent,
        invested,
        withdrawn: sum(flowRows("withdraw", window.start, window.end)),
        saved: income - spent,
        savings_rate: pct(income - spent, income),
        invest_rate: pct(invested, income),
      });
      window = previousPeriod(anchor, window.start);
    }
    const { start, end } = currentPeriod();
    const accounts = demo.accounts();
    const liquid = accounts.filter((a) => !isInvestment(a.type) && a.balance > 0).reduce((s, a) => s + a.balance, 0);
    const owed = accounts.filter((a) => !isInvestment(a.type) && a.balance < 0).reduce((s, a) => s - a.balance, 0);
    const investments = accounts.filter((a) => isInvestment(a.type)).reduce((s, a) => s + (a.value ?? a.balance), 0);
    const grouped = (flow: Flow, byAccountType: boolean): GroupRow[] => {
      const buckets = new Map<string, GroupRow>();
      for (const t of flowRows(flow, start, end)) {
        const account = d.accounts.find((a) => a.id === t.account_id);
        const byType = byAccountType && account && isInvestment(account.type);
        const key = byType ? account!.type : t.category_id ?? "uncategorised";
        const label = byType ? account!.name : catName(t.category_id) ?? "Uncategorised";
        const b = buckets.get(key) ?? { key, label, total: 0, count: 0 };
        b.total += t.amount;
        b.count += 1;
        buckets.set(key, b);
      }
      return [...buckets.values()].sort((a, b) => b.total - a.total);
    };
    return {
      periods: history,
      income_by_source: grouped("income", false),
      invested_by_type: grouped("invest", true),
      net_worth: liquid + investments - owed,
      liquid,
      investments,
      owed,
    };
  },
  addDefaultCategories: () => {
    const d = db();
    Object.entries(DEFAULT_CATS).forEach(([parent, kids], i) => {
      let p = d.categories.find((c) => !c.parent_id && c.name.toLowerCase() === parent.toLowerCase());
      if (!p) {
        p = { id: uid(), parent_id: null, name: parent, kind: KINDS[parent] ?? "expense", colour: ["green", "clay", "butter"][i % 3] };
        d.categories.push(p);
      }
      for (const k of kids) {
        if (!d.categories.some((c) => c.parent_id === p!.id && c.name.toLowerCase() === k.toLowerCase())) {
          d.categories.push({ id: uid(), parent_id: p.id, name: k, kind: p.kind, colour: p.colour });
        }
      }
    });
    persist();
    return d.categories;
  },
  categories: () => db().categories,

  createCategory: (body: { name: string; parent_id?: string | null }) => {
    const d = db();
    const name = body.name.trim();
    if (!name) throw new Error("A category needs a name");
    const parent = body.parent_id ? d.categories.find((c) => c.id === body.parent_id) : null;
    if (body.parent_id && !parent) throw new Error("Parent category not found in this household");
    if (parent?.parent_id) throw new Error("Categories are two levels deep; pick a top-level parent");
    const clash = d.categories.some(
      (c) => (c.parent_id ?? null) === (body.parent_id ?? null) && c.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) throw new Error(`“${name}” already exists there`);
    const category: Category = {
      id: uid(),
      parent_id: parent?.id ?? null,
      name,
      kind: parent?.kind ?? "expense",
      colour: parent?.colour ?? "green",
    };
    d.categories.push(category);
    persist();
    return category;
  },

  household: (): Household => ({ ...db().household }),

  updateHousehold: (body: Partial<Pick<Household, "name" | "cycle_start_day">>): Household => {
    const d = db();
    if (body.cycle_start_day !== undefined) {
      if (body.cycle_start_day < 1 || body.cycle_start_day > 28) throw new Error("Pick a day between 1 and 28");
      d.household.cycle_start_day = Math.floor(body.cycle_start_day);
    }
    if (body.name) d.household.name = body.name;
    persist();
    return { ...d.household };
  },

  transactions: (params: Record<string, string | number | boolean> = {}) => {
    const d = db();
    let rows = [...d.transactions];
    if (params.flow) {
      const l = lookup(d.accounts, d.categories);
      rows = rows.filter((t) => flowOf(t, l) === params.flow);
    }
    if (params.exclude_transfers) rows = rows.filter((t) => !(t as Txn & { transfer_id?: string }).transfer_id);
    if (params.account_id) rows = rows.filter((t) => t.account_id === params.account_id);
    if (params.category_id) rows = rows.filter((t) => t.category_id === params.category_id);
    if (params.direction) rows = rows.filter((t) => t.direction === params.direction);
    if (params.needs_review) rows = rows.filter((t) => t.needs_review);
    if (params.start) rows = rows.filter((t) => t.occurred_at >= String(params.start));
    if (params.end) rows = rows.filter((t) => t.occurred_at <= String(params.end));
    if (params.uncategorised) rows = rows.filter((t) => !t.category_id);
    if (params.tag) {
      const [tag] = normaliseTags([String(params.tag)]);
      rows = rows.filter((t) => (t.tags ?? []).includes(tag));
    }
    if (params.q) {
      const q = String(params.q).toLowerCase();
      rows = rows.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          (t.note ?? "").toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.includes(q)),
      );
    }
    rows.sort((a, b) => {
      if (a.occurred_at !== b.occurred_at) return a.occurred_at < b.occurred_at ? 1 : -1;
      return (b.created_at ?? "") > (a.created_at ?? "") ? 1 : -1;
    });
    const limit = Number(params.limit ?? 200);
    const offset = Number(params.offset ?? 0);
    return rows.slice(offset, offset + limit).map(withNames);
  },

  count: (params: Record<string, string | number | boolean> = {}) => {
    const rows = demo.transactions({ ...params, limit: 100000, offset: 0 });
    const out = rows.filter((t) => t.direction === "debit").reduce((sum, t) => sum + t.amount, 0);
    const income = rows.filter((t) => t.direction === "credit").reduce((sum, t) => sum + t.amount, 0);
    return { count: rows.length, out, income, net: income - out };
  },

  /** Same contract as GET /transactions/group: one flow, spending by default. */
  group: (by: "category" | "day" | "merchant", start?: string, end?: string, flow: Flow = "spend"): GroupRow[] => {
    const buckets = new Map<string, GroupRow>();
    for (const t of flowRows(flow, start, end)) {
      const key = by === "category" ? t.category_id ?? "uncategorised" : by === "merchant" ? t.merchant : t.occurred_at;
      const label = by === "category" ? catName(t.category_id) ?? "Uncategorised" : key;
      const bucket = buckets.get(key) ?? { key, label, total: 0, count: 0 };
      bucket.total += t.amount;
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  },

  transaction: (id: string) => {
    const d = db();
    const tx = d.transactions.find((t) => t.id === id);
    if (!tx) throw new Error("Transaction not found");
    const category = d.categories.find((c) => c.id === tx.category_id) ?? null;
    const parent = category?.parent_id ? d.categories.find((c) => c.id === category.parent_id) ?? null : null;
    const batch = tx.import_batch_id ? d.batches.find((b) => b.id === tx.import_batch_id) ?? null : null;

    return {
      ...tx,
      tags: tx.tags ?? [],
      account_name: d.accounts.find((a) => a.id === tx.account_id)?.name ?? null,
      category_name: category?.name ?? null,
      category_parent: parent?.name ?? null,
      confidence: tx.confidence ?? 1,
      needs_review: Boolean(tx.needs_review),
      transfer_id: (tx as Txn & { transfer_id?: string }).transfer_id ?? null,
      dedupe_hash: tx.dedupe_hash ?? null,
      created_at: tx.created_at ?? null,
      import_filename: batch?.filename ?? null,
      import_batch_id: tx.import_batch_id ?? null,
    };
  },

  createTransaction: (body: Record<string, unknown>) => {
    const d = db();
    const account = d.accounts.find((a) => a.id === body.account_id);
    if (!account || account.archived) throw new Error("Account not found in this household");
    const merchant = String(body.merchant ?? "").trim();
    if (!merchant) throw new Error("merchant: say who it was with, e.g. Swiggy or Rent");
    if (!(Number(body.amount) > 0)) throw new Error("amount: enter an amount above zero");
    if (body.category_id && !d.categories.some((c) => c.id === body.category_id)) {
      throw new Error("Category not found in this household");
    }

    // a known merchant or a rule files the row; anything else stays uncategorised, not guessed
    let categoryId = (body.category_id as string) || null;
    if (!categoryId) {
      const rule = d.rules.find((r) => merchant.toLowerCase().includes(r.pattern.toLowerCase()));
      const known = matchMerchant(merchant).category;
      categoryId =
        rule?.category_id ?? (known ? d.categories.find((c) => c.parent_id && c.name === known)?.id ?? null : null);
    }

    const t: Txn = {
      id: uid(),
      account_id: account.id,
      amount: Number(body.amount),
      direction: (body.direction as "debit" | "credit") ?? "debit",
      occurred_at: String(body.occurred_at ?? todayISO()),
      merchant,
      category_id: categoryId,
      note: String(body.note ?? "").trim(),
      tags: normaliseTags((body.tags as string[] | undefined) ?? []),
      source: "manual",
    };
    d.transactions.push(t);
    persist();
    recalc();
    return withNames(t);
  },

  /** Removing one half of a transfer removes both, so balances stay true. */
  deleteTransactions: (ids: string[]) => {
    const d = db();
    const hit = d.transactions.filter((t) => ids.includes(t.id));
    const transfers = new Set(hit.map((t) => (t as Txn & { transfer_id?: string }).transfer_id).filter(Boolean));
    const doomed = new Set(
      d.transactions
        .filter((t) => ids.includes(t.id) || transfers.has((t as Txn & { transfer_id?: string }).transfer_id))
        .map((t) => t.id),
    );
    if (doomed.size === 0) throw new Error("Transaction not found");
    d.transactions = d.transactions.filter((t) => !doomed.has(t.id));
    persist();
    recalc();
    return { deleted: doomed.size };
  },

  undoImport: (batchId: string) => {
    const d = db();
    const batch = d.batches.find((b) => b.id === batchId);
    if (!batch) throw new Error("Import not found");
    const before = d.transactions.length;
    d.transactions = d.transactions.filter((t) => t.import_batch_id !== batchId);
    d.rows = d.rows.filter((r) => r.batch_id !== batchId);
    d.batches = d.batches.filter((b) => b.id !== batchId);
    persist();
    recalc();
    return { deleted: before - d.transactions.length };
  },

  removeAccount: (id: string) => {
    const d = db();
    const account = d.accounts.find((a) => a.id === id);
    if (!account) throw new Error("Account not found");
    const used = d.transactions.filter((t) => t.account_id === id).length;
    if (used || d.batches.some((b) => b.account_id === id)) {
      account.archived = true;
      persist();
      return { result: "archived" as const, transactions: used };
    }
    d.accounts = d.accounts.filter((a) => a.id !== id);
    persist();
    return { result: "deleted" as const, transactions: 0 };
  },

  recategorise: (id: string, category_id: string) => demo.updateTransaction(id, { category_id }),

  updateTransaction: (id: string, patch: TransactionPatch) => {
    const d = db();
    const t = d.transactions.find((x) => x.id === id);
    if (!t) throw new Error("Transaction not found");
    if (patch.category_id !== undefined) {
      if (patch.category_id && !d.categories.some((c) => c.id === patch.category_id)) {
        throw new Error("Category not found in this household");
      }
      t.category_id = patch.category_id || null;
      t.needs_review = false;
      t.confidence = 1;
    }
    if (patch.note !== undefined) t.note = patch.note.trim();
    if (patch.tags !== undefined) t.tags = normaliseTags(patch.tags);
    if (patch.merchant?.trim()) t.merchant = patch.merchant.trim();
    const edits = { amount: patch.amount, occurred_at: patch.occurred_at, direction: patch.direction };
    if (Object.values(edits).some((v) => v !== undefined)) {
      if ((t as Txn & { transfer_id?: string }).transfer_id) {
        throw new Error("This is one half of a transfer; delete the transfer and record it again to change it");
      }
      if (edits.amount !== undefined) {
        if (!(edits.amount > 0)) throw new Error("amount: enter an amount above zero");
        t.amount = edits.amount;
      }
      if (edits.occurred_at) t.occurred_at = edits.occurred_at;
      if (edits.direction) t.direction = edits.direction;
      t.dedupe_hash = undefined;
      recalc();
    }
    persist();
    return withNames(t);
  },

  summary: (): Summary => {
    const month = todayISO().slice(0, 7);
    const rows = db().transactions.filter((t) => t.occurred_at.startsWith(month));
    const spent = sum(flowRows("spend", `${month}-01`, `${month}-31`));
    const income = sum(flowRows("income", `${month}-01`, `${month}-31`));
    return { spent, income, net: income - spent, count: rows.length };
  },

  seedDemo: () => {
    const d = db();
    const byName = new Map(d.categories.map((c) => [c.name, c.id]));
    const [bank, card, cash] = d.accounts;
    const rndInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
    const rndMoney = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) / 10) * 10 * 100;
    const start = addDays(todayISO(), -179);
    let made = 0;
    for (let i = 0; i < 180; i++) {
      const day = addDays(start, i);
      const dow = new Date(day + "T00:00:00").getDay();
      const n = dow === 0 || dow === 6 ? rndInt(3, 5) : rndInt(2, 4);
      for (let k = 0; k < n; k++) {
        const [name, cat, weight, [lo, hi]] = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
        if (Math.random() * 10 > weight + 5) continue;
        const acct = Math.random() < 0.55 ? bank : Math.random() < 0.7 ? card : cash;
        d.transactions.push({
          id: uid(),
          account_id: acct.id,
          direction: "debit",
          amount: rndMoney(lo, hi),
          occurred_at: day,
          merchant: name,
          category_id: byName.get(cat) ?? null,
          note: "",
          source: "seed",
        });
        made++;
      }
      if (day.endsWith("-01")) {
        d.transactions.push({ id: uid(), account_id: bank.id, direction: "credit", amount: 14_200_000, occurred_at: day, merchant: "Salary — Acme", category_id: byName.get("Salary") ?? null, note: "", source: "seed" });
        d.transactions.push({ id: uid(), account_id: bank.id, direction: "debit", amount: 3_200_000, occurred_at: day, merchant: "Rent", category_id: byName.get("Rent") ?? null, note: "", source: "seed" });
        made += 2;
      }
    }
    persist();
    recalc();
    return { created: made };
  },

  rules: () => db().rules,

  createRule: (input: { pattern: string; category_id: string; name?: string; match_type?: Rule["match_type"] }) => {
    const d = db();
    const rule: Rule = {
      id: uid(),
      pattern: input.pattern,
      category_id: input.category_id,
      category_name: d.categories.find((c) => c.id === input.category_id)?.name ?? null,
      name: input.name ?? input.pattern,
      match_type: input.match_type ?? "contains",
      priority: 100,
    };
    d.rules.push(rule);
    persist();
    return rule;
  },

  deleteRule: (id: string) => {
    const d = db();
    d.rules = d.rules.filter((r) => r.id !== id);
    persist();
  },

  previewImport: (input: { account_id: string; filename?: string; csv: string; mapping?: Mapping }): ImportPreview => {
    const d = db();
    const { mapping, rows, warnings } = buildCandidates(input.csv, input.account_id, input.mapping);
    if (rows.length === 0) throw new Error("No readable rows in that file");

    const byName = new Map(d.categories.map((c) => [c.name, c.id]));
    const existing = new Set(d.transactions.map((t) => t.dedupe_hash).filter(Boolean) as string[]);

    const batch: ImportBatch = {
      id: uid(),
      account_id: input.account_id,
      filename: input.filename ?? "statement.csv",
      status: "preview",
      row_count: rows.length,
      duplicate_count: 0,
      review_count: 0,
      imported_count: 0,
      created_at: new Date().toISOString(),
      mapping,
      warnings,
    };

    const importRows: ImportRow[] = rows.map((row) => {
      const matched = matchMerchant(row.description);
      const rule = d.rules.find((r) => {
        if (r.match_type === "equals") return row.description.trim().toLowerCase() === r.pattern.trim().toLowerCase();
        if (r.match_type === "regex") {
          try {
            return new RegExp(r.pattern, "i").test(row.description);
          } catch {
            return false;
          }
        }
        return row.description.toLowerCase().includes(r.pattern.toLowerCase());
      });

      const categoryId = rule?.category_id ?? (matched.category ? byName.get(matched.category) ?? null : null);
      const confidence = rule ? 1 : categoryId ? 0.95 : 0;
      const hash = dedupeHash(input.account_id, row.occurredAt, row.amount, row.description);
      const isDuplicate = existing.has(hash);
      existing.add(hash);

      const status: ImportRow["status"] = isDuplicate ? "duplicate" : confidence < REVIEW_THRESHOLD ? "review" : "ready";
      if (status === "duplicate") batch.duplicate_count += 1;
      if (status === "review") batch.review_count += 1;

      return {
        id: uid(),
        batch_id: batch.id,
        line_no: row.lineNo,
        occurred_at: row.occurredAt,
        description: row.description,
        merchant: matched.merchant,
        direction: row.direction,
        amount: row.amount,
        category_id: categoryId,
        category_name: categoryId ? d.categories.find((c) => c.id === categoryId)?.name ?? null : null,
        confidence,
        reason: rule ? "rule" : categoryId ? "merchant" : "none",
        is_duplicate: isDuplicate,
        status,
      };
    });

    d.batches.unshift(batch);
    d.rows.push(...importRows);
    persist();
    return { batch, rows: importRows };
  },

  commitImport: (batchId: string, decisions: ImportDecision[] = []): ImportBatch => {
    const d = db();
    const batch = d.batches.find((b) => b.id === batchId);
    if (!batch) throw new Error("Import not found");
    if (batch.status === "committed") return batch;

    const rows = d.rows.filter((r) => r.batch_id === batchId);
    const byId = new Map(decisions.map((x) => [x.row_id, x]));
    const existing = new Set(d.transactions.map((t) => t.dedupe_hash).filter(Boolean) as string[]);

    let imported = 0;
    for (const row of rows) {
      const decision = byId.get(row.id);
      if (decision?.action === "skip") {
        row.status = "skipped";
        continue;
      }
      if (row.is_duplicate) {
        row.status = "duplicate";
        continue;
      }

      const categoryId = decision?.category_id ?? row.category_id;
      const hash = dedupeHash(batch.account_id, row.occurred_at, row.amount, row.description);
      if (existing.has(hash)) {
        row.status = "duplicate";
        continue;
      }

      d.transactions.push({
        id: uid(),
        account_id: batch.account_id,
        direction: row.direction,
        amount: row.amount,
        occurred_at: row.occurred_at,
        merchant: row.merchant,
        category_id: categoryId ?? null,
        note: row.description,
        source: "import",
        confidence: row.confidence,
        needs_review: row.confidence < REVIEW_THRESHOLD,
        dedupe_hash: hash,
        import_batch_id: batch.id,
      });
      existing.add(hash);
      row.status = "imported";
      row.category_id = categoryId ?? null;
      imported += 1;
    }

    batch.status = "committed";
    batch.imported_count = imported;
    persist();
    recalc();
    return batch;
  },

  imports: () => db().batches,

  review: (): ReviewRow[] =>
    db()
      .transactions.filter((t) => t.needs_review)
      .map((t) => {
        const matched = matchMerchant(`${t.merchant} ${t.note ?? ""}`);
        const suggested = matched.category
          ? db().categories.find((c) => c.name === matched.category)?.id ?? null
          : null;
        return { ...withNames(t), suggested_category_id: suggested };
      }),

  bulkCategorise: (ids: string[], categoryId: string) => {
    const d = db();
    let updated = 0;
    for (const t of d.transactions) {
      if (!ids.includes(t.id)) continue;
      t.category_id = categoryId;
      t.confidence = 1;
      t.needs_review = false;
      updated += 1;
    }
    persist();
    return { updated };
  },

  budgets: () => db().budgets,

  createBudget: (input: { category_id?: string | null; amount: number; rollover?: boolean; fixed?: boolean; name?: string }) => {
    const d = db();
    const categoryId = input.category_id ?? null;
    const category = categoryId ? d.categories.find((c) => c.id === categoryId) : null;
    if (categoryId && !category) throw new Error("Category not found in this household");
    if (category && category.kind !== "expense") throw new Error("Budgets cap spending; income categories cannot have one");
    if (d.budgets.some((b) => b.is_active && (b.category_id ?? null) === categoryId)) {
      throw new Error(`There is already a budget for this ${categoryId ? "category" : "household"}; change its amount instead`);
    }
    const budget: Budget = {
      id: uid(),
      name: input.name ?? category?.name ?? "Overall",
      category_id: categoryId,
      period: "monthly",
      amount: input.amount,
      rollover: input.rollover ?? false,
      fixed: input.fixed ?? false,
      is_active: true,
    };
    d.budgets.push(budget);
    persist();
    return budget;
  },

  updateBudget: (id: string, body: { amount?: number; rollover?: boolean; fixed?: boolean; name?: string }) => {
    const budget = db().budgets.find((b) => b.id === id);
    if (!budget) throw new Error("Budget not found");
    if (body.amount !== undefined) {
      if (!(body.amount > 0)) throw new Error("A budget needs an amount above zero");
      budget.amount = body.amount;
    }
    if (body.rollover !== undefined) budget.rollover = body.rollover;
    if (body.fixed !== undefined) budget.fixed = body.fixed;
    if (body.name) budget.name = body.name;
    persist();
    return budget;
  },

  deleteBudget: (id: string) => {
    const d = db();
    d.budgets = d.budgets.filter((b) => b.id !== id);
    persist();
  },

  budgetSuggestions: (): BudgetSuggestion[] => {
    const d = db();
    const anchor = d.household.cycle_start_day;
    const windows: { start: string; end: string }[] = [];
    let start = periodBounds(anchor, new Date()).start;
    for (let i = 0; i < 3; i++) {
      const prev = previousPeriod(anchor, start);
      windows.push(prev);
      start = prev.start;
    }
    const rows = flowRows("spend", windows[2].start, windows[0].end);
    const active = windows.filter((w) => rows.some((t) => t.occurred_at >= w.start && t.occurred_at <= w.end)).length;
    if (!active) return [];
    const totals = new Map<string | null, number>();
    for (const t of rows) {
      const parent = t.category_id ? d.categories.find((c) => c.id === t.category_id)?.parent_id : null;
      for (const key of [null, t.category_id, parent].filter((k, i) => i === 0 || k)) {
        totals.set(key ?? null, (totals.get(key ?? null) ?? 0) + t.amount);
      }
    }
    return [...totals.entries()].map(([category_id, total]) => ({
      category_id,
      average: Math.floor(total / active),
      periods: active,
    }));
  },

  budgetStatus: (): BudgetStatus[] => {
    const d = db();
    const anchor = d.household.cycle_start_day;
    const today = new Date();
    const { start, end } = periodBounds(anchor, today);
    const elapsed = elapsedFraction(start, end, today);
    const daysLeft = Math.max(daysBetween(toISO(today), end) + 1, 0);
    const order = { overall: 0, group: 1, category: 2 };

    const spendNow = flowRows("spend", start, end);

    return d.budgets
      .filter((b) => b.is_active)
      .map((budget) => {
        const scope = categoryScope(budget.category_id, d.categories);
        const spent = sum(spendNow.filter((t) => !scope || (t.category_id !== null && scope.has(t.category_id))));
        const allocated = budget.amount;
        const remaining = allocated - spent;
        const used = allocated ? (spent / allocated) * 100 : 0;
        const category = d.categories.find((c) => c.id === budget.category_id);
        const fixed = Boolean(budget.fixed);

        return {
          id: budget.id,
          name: budget.name,
          category_id: budget.category_id,
          category_name: category?.name ?? null,
          parent_id: category?.parent_id ?? null,
          scope: budgetScope(budget.category_id, d.categories),
          period_start: start,
          period_end: end,
          allocated,
          carried: 0,
          spent,
          remaining,
          used_pct: Math.round(used * 10) / 10,
          elapsed_pct: Math.round(elapsed * 1000) / 10,
          status: paceStatus(spent, allocated, elapsed, fixed),
          rollover: budget.rollover,
          fixed,
          category_kind: category?.kind ?? null,
          days_left: daysLeft,
          daily_allowance: fixed || !daysLeft ? 0 : Math.floor(Math.max(remaining, 0) / daysLeft),
          projected: fixed ? null : projectedSpend(spent, elapsed),
        };
      })
      .sort((a, b) => order[a.scope] - order[b.scope] || a.name.localeCompare(b.name));
  },

  goals: () => db().goals,

  createGoal: (input: { name: string; target: number; monthly_target?: number | null }) => {
    const d = db();
    const goal = {
      id: uid(),
      name: input.name,
      target: input.target,
      contributed: 0,
      progress_pct: 0,
      monthly_target: input.monthly_target ?? null,
      target_date: null,
      projected_finish: null,
      status: "active",
      contributions: [] as { amount: number; on: string }[],
    };
    d.goals.push(goal);
    persist();
    return goal;
  },

  contribute: (goalId: string, amount: number) => {
    const d = db();
    const goal = d.goals.find((g) => g.id === goalId);
    if (!goal) throw new Error("Goal not found");
    goal.contributions.push({ amount, on: toISO(new Date()) });
    return refreshGoal(goal);
  },

  undoContribution: (goalId: string) => {
    const goal = db().goals.find((g) => g.id === goalId);
    if (!goal) throw new Error("Goal not found");
    if (goal.contributions.length === 0) throw new Error("Nothing to undo: no contributions yet");
    goal.contributions.pop();
    return refreshGoal(goal);
  },

  deleteGoal: (goalId: string) => {
    const d = db();
    if (!d.goals.some((g) => g.id === goalId)) throw new Error("Goal not found");
    d.goals = d.goals.filter((g) => g.id !== goalId);
    persist();
  },

  dashboard: (): Dashboard => {
    const d = db();
    const anchor = d.household.cycle_start_day;
    const today = new Date();
    const { start, end } = periodBounds(anchor, today);
    const prev = previousPeriod(anchor, start);

    const inWindow = (from: string, to: string, direction: "debit" | "credit") =>
      flowRows(direction === "debit" ? "spend" : "income", from, to);

    const rows = inWindow(start, end, "debit");
    const spent = rows.reduce((s, t) => s + t.amount, 0);
    const income = inWindow(start, end, "credit").reduce((s, t) => s + t.amount, 0);
    const prevIncome = inWindow(prev.start, prev.end, "credit").reduce((s, t) => s + t.amount, 0);
    const invested = sum(flowRows("invest", start, end));
    const planned = savingsDue(start, end);

    const statuses = demo.budgetStatus();
    const budgetedRemaining = reservedByBudgets(statuses);
    const series = detectSeries(flowRows("spend"), today);
    const committed = series
      .filter((s) => s.next_due >= start && s.next_due <= end)
      .reduce((sum, s) => sum + s.expected_amount, 0);

    const byDay = new Map<string, number>();
    for (const t of rows) byDay.set(t.occurred_at, (byDay.get(t.occurred_at) ?? 0) + t.amount);
    const sparkline: { date: string; amount: number }[] = [];
    const cursor = new Date(`${start}T00:00:00`);
    while (toISO(cursor) <= end) {
      sparkline.push({ date: toISO(cursor), amount: byDay.get(toISO(cursor)) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const expectedIncome = income || prevIncome;
    const catName = (id: string | null) => d.categories.find((c) => c.id === id)?.name ?? "Uncategorised";
    const prevByCat = new Map<string, number>();
    const elapsedDays = daysBetween(start, toISO(today));
    const prevCutoff = toISO(new Date(new Date(`${prev.start}T00:00:00`).getTime() + elapsedDays * 86400000));
    for (const t of inWindow(prev.start, prev.end, "debit").filter((r) => r.occurred_at <= prevCutoff)) {
      const key = t.category_id ?? "none";
      prevByCat.set(key, (prevByCat.get(key) ?? 0) + t.amount);
    }
    const curByCat = new Map<string, number>();
    for (const t of rows) {
      const key = t.category_id ?? "none";
      curByCat.set(key, (curByCat.get(key) ?? 0) + t.amount);
    }

    const insights = [...curByCat.entries()]
      .map(([key, amount]) => ({ key, amount, base: prevByCat.get(key) ?? 0 }))
      .filter((row) => row.base > 0 && Math.abs(row.amount - row.base) >= 50000)
      .sort((a, b) => Math.abs(b.amount - b.base) - Math.abs(a.amount - a.base))
      .slice(0, 3)
      .map((row) => ({
        kind: "month_delta",
        severity: row.amount > row.base ? "warn" : "info",
        title: `${catName(row.key === "none" ? null : row.key)} is ${
          row.amount > row.base ? "up" : "down"
        } ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
          Math.abs(row.amount - row.base) / 100,
        )}`,
        fact_pack: {
          query: "sum(transactions.amount) group by category_id",
          category_id: row.key,
          category_name: catName(row.key === "none" ? null : row.key),
          current: row.amount,
          previous: row.base,
          delta: row.amount - row.base,
        },
      }));

    return {
      period_start: start,
      period_end: end,
      period_label: periodLabel(start, end),
      days_left: Math.max(daysBetween(toISO(today), end) + 1, 0),
      elapsed_pct: Math.round(elapsedFraction(start, end, today) * 1000) / 10,
      income,
      spent,
      invested,
      savings_due: planned,
      committed,
      budgeted_remaining: budgetedRemaining,
      free_to_spend: expectedIncome - spent - invested - committed - planned - budgetedRemaining,
      budgets: statuses,
      goals: d.goals.map((g) => ({ ...g, contributions: undefined })) as unknown as Goal[],
      due_soon: series
        .filter((s) => s.next_due >= start && s.next_due <= end)
        .slice(0, 5)
        .map((s) => ({ merchant: s.merchant, amount: s.expected_amount, due: s.next_due, cadence: s.cadence })),
      sparkline,
      insights,
    };
  },

  recurring: () => detectSeries(flowRows("spend"), new Date()),

  reset: () => {
    cache = blank();
    persist();
  },
};

export const isDemoMode = () => !process.env.NEXT_PUBLIC_API_URL;
