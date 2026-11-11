import { demo, isDemoMode } from "./demo";
import type { Account, Category, Summary, Txn } from "./types";

export type { Account, Category, Summary, Txn };

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("gullak_token");
}

export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  t ? window.localStorage.setItem("gullak_token", t) : window.localStorage.removeItem("gullak_token");
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/**
 * One interface, two transports: the FastAPI backend when NEXT_PUBLIC_API_URL is
 * set, otherwise the in-browser demo store so the static export works on its own.
 */
export const api = {
  signup: (email: string, password: string, name: string): Promise<{ access_token: string }> =>
    isDemoMode()
      ? Promise.resolve(demo.signup(email, password, name))
      : req("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) }),

  login: (email: string, password: string): Promise<{ access_token: string }> =>
    isDemoMode()
      ? Promise.resolve(demo.login(email, password))
      : req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: (): Promise<{ id: string; name: string; email: string; household_id: string }> =>
    isDemoMode() ? Promise.resolve(demo.me()) : req("/me"),

  accounts: (): Promise<Account[]> => (isDemoMode() ? Promise.resolve(demo.accounts()) : req("/accounts")),

  createAccount: (body: Partial<Account>): Promise<Account> =>
    isDemoMode() ? Promise.resolve(demo.createAccount(body)) : req("/accounts", { method: "POST", body: JSON.stringify(body) }),

  categories: (): Promise<Category[]> => (isDemoMode() ? Promise.resolve(demo.categories()) : req("/categories")),

  transactions: (params: Record<string, string | number> = {}): Promise<Txn[]> =>
    isDemoMode()
      ? Promise.resolve(demo.transactions(params))
      : req(`/transactions?${new URLSearchParams(params as Record<string, string>).toString()}`),

  createTransaction: (body: Record<string, unknown>): Promise<Txn> =>
    isDemoMode() ? Promise.resolve(demo.createTransaction(body)) : req("/transactions", { method: "POST", body: JSON.stringify(body) }),

  recategorise: (id: string, category_id: string): Promise<Txn> =>
    isDemoMode()
      ? Promise.resolve(demo.recategorise(id, category_id))
      : req(`/transactions/${id}?category_id=${category_id}`, { method: "PATCH" }),

  summary: (): Promise<Summary> => (isDemoMode() ? Promise.resolve(demo.summary()) : req("/transactions/summary")),

  seedDemo: (): Promise<{ created: number }> =>
    isDemoMode() ? Promise.resolve(demo.seedDemo()) : req("/demo/seed", { method: "POST" }),

  resetDemo: (): Promise<void> => {
    demo.reset();
    return Promise.resolve();
  },
};

export { isDemoMode };

export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
