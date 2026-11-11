"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, isDemoMode, setToken } from "@/lib/api";
import s from "./page.module.scss";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = mode === "login" ? await api.login(email, password) : await api.signup(email, password, name || "Friend");
      setToken(res.access_token);
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className={s.wrap}>
      <section className={s.brand}>
        <h1>A ledger detailed enough for an accountant.</h1>
        <p>MVP 0 — accounts, categories and a ledger you can trust, before any agent touches it.</p>
        <ul>
          <li>Transactions with provenance and inline recategorisation</li>
          <li>Every row scoped to your household</li>
          <li>Quick add that understands “320 swiggy yesterday”</li>
        </ul>
      </section>

      <section className={s.form}>
        <form onSubmit={submit} className={s.box}>
          <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
          <p className="small muted" style={{ marginBottom: 22 }}>
            {mode === "login"
              ? "Welcome back. Your ledger is where you left it."
              : "One account, one household, and a ledger that starts empty."}
          </p>

          {mode === "signup" && (
            <div className="field">
              <label>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </div>

          <button className="btn" type="submit" style={{ width: "100%" }}>
            {mode === "login" ? "Sign in" : "Create account"}
          </button>

          {isDemoMode() && (
            <button
              type="button"
              className="btn btn--ghost"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => {
                setToken("demo-token");
                router.push("/");
              }}
            >
              Continue in demo mode
            </button>
          )}

          {error && <p className={s.err}>{error}</p>}

          <p className={s.switch}>
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
