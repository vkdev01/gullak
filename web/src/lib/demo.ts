/**
 * Demo transport for the static build (GitHub Pages).
 *
 * When NEXT_PUBLIC_API_URL is not set, the app runs entirely in the browser
 * against localStorage so the static export is usable without a server.
 * It mirrors the FastAPI contract in backend/ — same shapes, same rules —
 * and is deliberately not a substitute for it: no auth, no real isolation.
 */
import type { Account, Category, Summary, Txn } from "./types";

const KEY = "gullak.static.v1";

type DB = {
  household: { id: string; name: string; currency: string };
  accounts: Account[];
  categories: Category[];
  transactions: Txn[];
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
    household: { id: hid, name: "Demo household", currency: "INR" },
    accounts: [
      { id: uid(), name: "HDFC Savings", type: "bank", institution: "HDFC", masked_number: "8842", opening_balance: 4_250_000, balance: 4_250_000 },
      { id: uid(), name: "HDFC Credit Card", type: "credit_card", institution: "HDFC", masked_number: "4412", opening_balance: 0, balance: 0 },
      { id: uid(), name: "Cash", type: "cash", institution: "", masked_number: "", opening_balance: 4_000_000, balance: 4_000_000 },
    ],
    categories: cats,
    transactions: [],
  };
}

let cache: DB | null = null;

function db(): DB {
  if (cache) return cache;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (raw) {
      cache = JSON.parse(raw) as DB;
      return cache;
    }
  } catch {
    /* ignore */
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

  transactions: (params: Record<string, string | number> = {}) => {
    const d = db();
    let rows = [...d.transactions];
    if (params.account_id) rows = rows.filter((t) => t.account_id === params.account_id);
    if (params.category_id) rows = rows.filter((t) => t.category_id === params.category_id);
    if (params.direction) rows = rows.filter((t) => t.direction === params.direction);
    if (params.q) {
      const q = String(params.q).toLowerCase();
      rows = rows.filter((t) => t.merchant.toLowerCase().includes(q));
    }
    rows.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
    return rows.slice(0, Number(params.limit ?? 200)).map(withNames);
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

  reset: () => {
    cache = blank();
    persist();
  },
};

export const isDemoMode = () => !process.env.NEXT_PUBLIC_API_URL;
