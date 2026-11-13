/**
 * Smoke test for the demo transport.
 *
 * The static build keeps its data in localStorage, which means every visitor
 * carries a schema written by whichever version they first loaded. This probe
 * exercises the store against a fresh payload, a payload from an older build
 * and a corrupt one, so a missing key fails CI instead of someone's dashboard.
 *
 * Run with: npm run check:demo
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const store = new Map();

globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};

const DEMO = "../.probe/api/demo.js";

function load() {
  delete require.cache[require.resolve(DEMO)];
  return require(DEMO).demo;
}

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`ok   ${label}`);
  } catch (e) {
    failures += 1;
    console.log(`FAIL ${label} → ${e.constructor.name}: ${e.message}`);
  }
}

// 1. a first visit
let demo = load();
check("fresh store: dashboard", () => demo.dashboard());
check("fresh store: budget status", () => demo.budgetStatus());
check("fresh store: goals", () => demo.goals());

// 2. a store written before budgets and goals existed, and before the salary anchor
store.set(
  "gullak.static.v2",
  JSON.stringify({
    household: { id: "h1", name: "Old", currency: "INR" },
    accounts: [{ id: "a1", name: "HDFC", type: "bank", institution: "", masked_number: "", opening_balance: 0, balance: 0 }],
    categories: [{ id: "c1", parent_id: null, name: "Dining", kind: "expense", colour: "green" }],
    transactions: [
      {
        id: "t1", account_id: "a1", direction: "debit", amount: 1000,
        occurred_at: "2026-11-01", merchant: "Swiggy", category_id: "c1", note: "", source: "import",
      },
    ],
    rules: [], batches: [], rows: [],
  }),
);
demo = load();
check("older store: dashboard", () => demo.dashboard());
check("older store: budget status", () => demo.budgetStatus());
check("older store: goals", () => demo.goals());
check("older store: create budget", () => demo.createBudget({ category_id: "c1", amount: 500000 }));
check("older store: import preview", () =>
  demo.previewImport({ account_id: "a1", csv: "Date,Narration,Withdrawal Amt.\n02/11/2026,UPI/ZOMATO/1,300.00" }),
);
check("older store: review queue", () => demo.review());
check("older store: recurring", () => demo.recurring());

// 3. a store someone broke by hand
store.set("gullak.static.v2", "{not json");
demo = load();
check("corrupt store: dashboard", () => demo.dashboard());

console.log(failures === 0 ? "\ndemo store: all checks passed" : `\ndemo store: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
