/** HTTP transport for the FastAPI service. Used only when NEXT_PUBLIC_API_URL is set. */
const API = process.env.NEXT_PUBLIC_API_URL ?? "";

const TOKEN_KEY = "gullak_token";

export const hasApi = () => Boolean(API);

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") {
    setToken(null);
    const loginPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/login/`;
    if (window.location.pathname !== loginPath) window.location.assign(loginPath);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}
