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
import type {
  Account,
  Budget,
  BudgetStatus,
  Category,
  Dashboard,
  Goal,
  ImportBatch,
  ImportDecision,
  ImportPreview,
  ImportRow,
  ReviewRow,
  Rule,
  Summary,
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
  Transport: ["Cab", "Fuel", "Train", "Metro"],
  Shopping: ["Clothing", "Electronics", "Home"],
  Health: ["Pharmacy", "Doctor", "Fitness"],
  Entertainment: ["Subscriptions", "Movies", "Events"],
  Money: ["Fees", "Interest", "Insurance"],
  Income: ["Salary", "Freelance", "Refund"],
};

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
    cats.push({ id: pid, parent_id: null, name: parent, kind: parent === "Income" ? "income" : "expense", colour });
    kids.forEach((k) => cats.push({ id: uid(), parent_id: pid, name: k, kind: parent === "Income" ? "income" : "expense", colour }));
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
    return db().accounts;
  },
  createAccount: (body: Partial<Account>) => {
    const a: Account = {
      id: uid(),
      name: body.name ?? "Account",
      type: body.type ?? "bank",
      institution: body.institution ?? "",
      masked_number: body.masked_number ?? "",
      opening_balance: body.opening_balance ?? 0,
      balance: body.opening_balance ?? 0,
    };
    db().accounts.push(a);
    persist();
    return a;
  },
  categories: () => db().categories,

  transactions: (params: Record<string, string | number | boolean> = {}) => {
    const d = db();
    let rows = [...d.transactions];
    if (params.account_id) rows = rows.filter((t) => t.account_id === params.account_id);
    if (params.category_id) rows = rows.filter((t) => t.category_id === params.category_id);
    if (params.direction) rows = rows.filter((t) => t.direction === params.direction);
    if (params.needs_review) rows = rows.filter((t) => t.needs_review);
    if (params.start) rows = rows.filter((t) => t.occurred_at >= String(params.start));
    if (params.end) rows = rows.filter((t) => t.occurred_at <= String(params.end));
    if (params.uncategorised) rows = rows.filter((t) => !t.category_id);
    if (params.q) {
      const q = String(params.q).toLowerCase();
      rows = rows.filter(
        (t) => t.merchant.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q),
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

  transaction: (id: string) => {
    const d = db();
    const tx = d.transactions.find((t) => t.id === id);
    if (!tx) throw new Error("Transaction not found");
    const category = d.categories.find((c) => c.id === tx.category_id) ?? null;
    const parent = category?.parent_id ? d.categories.find((c) => c.id === category.parent_id) ?? null : null;
    const batch = tx.import_batch_id ? d.batches.find((b) => b.id === tx.import_batch_id) ?? null : null;

    return {
      ...tx,
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
    const t: Txn = {
      id: uid(),
      account_id: String(body.account_id),
      amount: Number(body.amount),
      direction: (body.direction as "debit" | "credit") ?? "debit",
      occurred_at: String(body.occurred_at ?? todayISO()),
      merchant: String(body.merchant ?? "Untitled"),
      category_id: (body.category_id as string) ?? null,
      note: String(body.note ?? ""),
      source: "manual",
    };
    db().transactions.push(t);
    persist();
    recalc();
    return withNames(t);
  },

  recategorise: (id: string, category_id: string) => {
    const t = db().transactions.find((x) => x.id === id);
    if (!t) throw new Error("Transaction not found");
    t.category_id = category_id;
    persist();
    return withNames(t);
  },

  summary: (): Summary => {
    const month = todayISO().slice(0, 7);
    const rows = db().transactions.filter((t) => t.occurred_at.startsWith(month));
    const spent = rows.filter((t) => t.direction === "debit").reduce((s, t) => s + t.amount, 0);
    const income = rows.filter((t) => t.direction === "credit").reduce((s, t) => s + t.amount, 0);
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

  createBudget: (input: { category_id?: string | null; amount: number; rollover?: boolean; name?: string }) => {
    const d = db();
    const budget: Budget = {
      id: uid(),
      name: input.name ?? d.categories.find((c) => c.id === input.category_id)?.name ?? "Envelope",
      category_id: input.category_id ?? null,
      period: "monthly",
      amount: input.amount,
      rollover: input.rollover ?? false,
      is_active: true,
    };
    d.budgets.push(budget);
    persist();
    return budget;
  },

  budgetStatus: (): BudgetStatus[] => {
    const d = db();
    const anchor = d.household.cycle_start_day;
    const today = new Date();
    const { start, end } = periodBounds(anchor, today);
    const elapsed = elapsedFraction(start, end, today) * 100;

    return d.budgets
      .filter((b) => b.is_active)
      .map((budget) => {
        const inPeriod = d.transactions.filter(
          (t) =>
            t.direction === "debit" &&
            !(t as Txn & { transfer_id?: string }).transfer_id &&
            t.occurred_at >= start &&
            t.occurred_at <= end &&
            (!budget.category_id || t.category_id === budget.category_id),
        );
        const spent = inPeriod.reduce((sum, t) => sum + t.amount, 0);
        const allocated = budget.amount;
        const remaining = allocated - spent;
        const used = allocated ? (spent / allocated) * 100 : 0;
        const status: BudgetStatus["status"] =
          spent > allocated ? "over" : spent / allocated > Math.max((elapsed + 15) / 100, 0.9) ? "at_risk" : "on_track";

        return {
          id: budget.id,
          name: budget.name,
          category_id: budget.category_id,
          category_name: d.categories.find((c) => c.id === budget.category_id)?.name ?? null,
          period_start: start,
          period_end: end,
          allocated,
          carried: 0,
          spent,
          remaining,
          used_pct: Math.round(used * 10) / 10,
          elapsed_pct: Math.round(elapsed * 10) / 10,
          status,
          rollover: budget.rollover,
        };
      });
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
    goal.contributed = goal.contributions.reduce((s, c) => s + c.amount, 0);
    goal.progress_pct = Math.round((goal.contributed / goal.target) * 1000) / 10;
    if (goal.monthly_target) {
      const months = Math.ceil(Math.max(goal.target - goal.contributed, 0) / goal.monthly_target);
      const finish = new Date();
      finish.setMonth(finish.getMonth() + months);
      goal.projected_finish = toISO(finish);
    }
    persist();
    return goal;
  },

  dashboard: (): Dashboard => {
    const d = db();
    const anchor = d.household.cycle_start_day;
    const today = new Date();
    const { start, end } = periodBounds(anchor, today);
    const prev = previousPeriod(anchor, start);

    const inWindow = (from: string, to: string, direction: "debit" | "credit") =>
      d.transactions.filter(
        (t) =>
          t.direction === direction &&
          !(t as Txn & { transfer_id?: string }).transfer_id &&
          t.occurred_at >= from &&
          t.occurred_at <= to,
      );

    const rows = inWindow(start, end, "debit");
    const spent = rows.reduce((s, t) => s + t.amount, 0);
    const income = inWindow(start, end, "credit").reduce((s, t) => s + t.amount, 0);
    const prevIncome = inWindow(prev.start, prev.end, "credit").reduce((s, t) => s + t.amount, 0);

    const statuses = demo.budgetStatus();
    const budgetedRemaining = statuses.reduce((s, b) => s + Math.max(b.remaining, 0), 0);
    const series = detectSeries(d.transactions, today);
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
      committed,
      budgeted_remaining: budgetedRemaining,
      free_to_spend: expectedIncome - spent - committed - budgetedRemaining,
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

  recurring: () => detectSeries(db().transactions, new Date()),

  reset: () => {
    cache = blank();
    persist();
  },
};

export const isDemoMode = () => !process.env.NEXT_PUBLIC_API_URL;
