import { demo } from "./demo";
import { hasApi, getToken, request, setToken } from "./client";
import type {
  Account,
  Budget,
  BudgetStatus,
  Category,
  Dashboard,
  Goal,
  GroupRow,
  Series,
  ImportBatch,
  ImportDecision,
  ImportPreview,
  ReviewRow,
  Rule,
  Summary,
  Txn,
} from "./types";

export type {
  Account,
  Budget,
  BudgetStatus,
  Category,
  Dashboard,
  Goal,
  GroupRow,
  ImportBatch,
  ImportDecision,
  ImportPreview,
  ImportRow,
  ReviewRow,
  Rule,
  Series,
  Summary,
  Txn,
} from "./types";
export { getToken, setToken };

/**
 * One interface, two transports: the FastAPI service when NEXT_PUBLIC_API_URL is
 * set, otherwise the in-browser demo store so the static export stands alone.
 */
export const isDemoMode = () => !hasApi();

export const api = {
  signup: (email: string, password: string, name: string): Promise<{ access_token: string }> =>
    isDemoMode()
      ? Promise.resolve(demo.signup(email, password, name))
      : request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) }),

  login: (email: string, password: string): Promise<{ access_token: string }> =>
    isDemoMode()
      ? Promise.resolve(demo.login(email, password))
      : request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: (): Promise<{ id: string; name: string; email: string; household_id: string }> =>
    isDemoMode() ? Promise.resolve(demo.me()) : request("/me"),

  accounts: (): Promise<Account[]> => (isDemoMode() ? Promise.resolve(demo.accounts()) : request("/accounts")),

  createAccount: (body: Partial<Account>): Promise<Account> =>
    isDemoMode() ? Promise.resolve(demo.createAccount(body)) : request("/accounts", { method: "POST", body: JSON.stringify(body) }),

  categories: (): Promise<Category[]> => (isDemoMode() ? Promise.resolve(demo.categories()) : request("/categories")),

  transactions: (params: Record<string, string | number> = {}): Promise<Txn[]> =>
    isDemoMode()
      ? Promise.resolve(demo.transactions(params))
      : request(`/transactions?${new URLSearchParams(params as Record<string, string>).toString()}`),

  createTransaction: (body: Record<string, unknown>): Promise<Txn> =>
    isDemoMode() ? Promise.resolve(demo.createTransaction(body)) : request("/transactions", { method: "POST", body: JSON.stringify(body) }),

  recategorise: (id: string, category_id: string): Promise<Txn> =>
    isDemoMode()
      ? Promise.resolve(demo.recategorise(id, category_id))
      : request(`/transactions/${id}?category_id=${category_id}`, { method: "PATCH" }),

  summary: (): Promise<Summary> => (isDemoMode() ? Promise.resolve(demo.summary()) : request("/transactions/summary")),

  seedDemo: (): Promise<{ created: number }> =>
    isDemoMode() ? Promise.resolve(demo.seedDemo()) : request("/demo/seed", { method: "POST" }),

  resetDemo: (): Promise<void> => {
    demo.reset();
    return Promise.resolve();
  },

  // ---- imports -------------------------------------------------------------
  previewImport: (body: { account_id: string; filename?: string; csv: string; mapping?: Record<string, string> }): Promise<ImportPreview> =>
    isDemoMode()
      ? Promise.resolve(demo.previewImport(body))
      : request("/imports/preview", { method: "POST", body: JSON.stringify(body) }),

  commitImport: (batchId: string, decisions?: ImportDecision[]): Promise<ImportBatch> =>
    isDemoMode()
      ? Promise.resolve(demo.commitImport(batchId, decisions))
      : request(`/imports/${batchId}/commit`, { method: "POST", body: JSON.stringify({ decisions: decisions ?? [] }) }),

  imports: (): Promise<ImportBatch[]> => (isDemoMode() ? Promise.resolve(demo.imports()) : request("/imports")),

  // ---- rules ---------------------------------------------------------------
  rules: (): Promise<Rule[]> => (isDemoMode() ? Promise.resolve(demo.rules()) : request("/rules")),

  createRule: (body: { pattern: string; category_id: string; name?: string; match_type?: Rule["match_type"] }): Promise<Rule> =>
    isDemoMode() ? Promise.resolve(demo.createRule(body)) : request("/rules", { method: "POST", body: JSON.stringify(body) }),

  deleteRule: (id: string): Promise<void> =>
    isDemoMode()
      ? Promise.resolve(demo.deleteRule(id))
      : request(`/rules/${id}`, { method: "DELETE" }),

  // ---- review --------------------------------------------------------------
  review: (): Promise<ReviewRow[]> => (isDemoMode() ? Promise.resolve(demo.review()) : request("/transactions/review")),

  bulkCategorise: (ids: string[], category_id: string): Promise<{ updated: number }> =>
    isDemoMode()
      ? Promise.resolve(demo.bulkCategorise(ids, category_id))
      : request("/transactions/bulk", { method: "POST", body: JSON.stringify({ ids, category_id }) }),

  // ---- planning ------------------------------------------------------------
  dashboard: (): Promise<Dashboard> => (isDemoMode() ? Promise.resolve(demo.dashboard()) : request("/dashboard")),

  budgets: (): Promise<Budget[]> => (isDemoMode() ? Promise.resolve(demo.budgets()) : request("/budgets")),

  createBudget: (body: { category_id?: string | null; amount: number; rollover?: boolean; name?: string }): Promise<Budget> =>
    isDemoMode() ? Promise.resolve(demo.createBudget(body)) : request("/budgets", { method: "POST", body: JSON.stringify(body) }),

  budgetStatus: (): Promise<BudgetStatus[]> =>
    isDemoMode() ? Promise.resolve(demo.budgetStatus()) : request("/budgets/status"),

  goals: (): Promise<Goal[]> => (isDemoMode() ? Promise.resolve(demo.goals()) : request("/goals")),

  createGoal: (body: { name: string; target: number; monthly_target?: number | null }): Promise<Goal> =>
    isDemoMode() ? Promise.resolve(demo.createGoal(body) as Goal) : request("/goals", { method: "POST", body: JSON.stringify(body) }),

  contribute: (goalId: string, amount: number): Promise<Goal> =>
    isDemoMode()
      ? Promise.resolve(demo.contribute(goalId, amount) as Goal)
      : request(`/goals/${goalId}/contributions`, { method: "POST", body: JSON.stringify({ amount }) }),

  recurring: (): Promise<Series[]> => (isDemoMode() ? Promise.resolve(demo.recurring()) : request("/recurring")),

  group: (by: "category" | "day" | "merchant", start?: string, end?: string): Promise<GroupRow[]> =>
    isDemoMode()
      ? Promise.resolve([])
      : request(`/transactions/group?by=${by}${start ? `&start=${start}` : ""}${end ? `&end=${end}` : ""}`),
};


/** Wipe the browser store and start again. Only meaningful in demo mode. */
export async function resetDemoData(): Promise<void> {
  demo.reset();
}
