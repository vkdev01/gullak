import { demo } from "./demo";
import { hasApi, getToken, request, setToken } from "./client";
import type { Account, Category, Summary, Txn } from "./types";

export type { Account, Category, Summary, Txn };
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
};

