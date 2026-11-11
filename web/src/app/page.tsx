"use client";

import { useEffect, useMemo, useState } from "react";
import { api, isDemoMode, type Account, type Category, type Summary, type Txn } from "@/lib/api";
import { money } from "@/lib/format";
import s from "./page.module.scss";

const todayISO = () => new Date().toISOString().slice(0, 10);

function dayLabel(iso: string) {
  const t = todayISO();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === t) return "Today";
  if (iso === y.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

export default function LedgerPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [a, c, t, sum] = await Promise.all([api.accounts(), api.categories(), api.transactions(), api.summary()]);
    setAccounts(a);
    setCats(c);
    setTxns(t);
    setSummary(sum);
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txns
      .filter((t) => !accountId || t.account_id === accountId)
      .filter((t) => !needle || t.merchant.toLowerCase().includes(needle));
  }, [txns, q, accountId]);

  const groups = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const t of filtered) {
      const list = map.get(t.occurred_at) ?? [];
      list.push(t);
      map.set(t.occurred_at, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  async function recategorise(id: string, categoryId: string) {
    const updated = await api.recategorise(id, categoryId);
    setTxns((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function seed() {
    setBusy(true);
    try {
      await api.seedDemo();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  /** "320 swiggy yesterday" → amount, merchant, date. Same parser as the prototype. */
  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    const raw = draft.trim();
    if (!raw) return;
    const m = raw.match(/(\d+(?:[.,]\d{1,2})?)/);
    if (!m) return;
    const amount = Math.round(parseFloat(m[1].replace(",", ".")) * 100);
    let merchant = raw.replace(m[0], "").replace(/\b(today|yesterday)\b/gi, "").replace(/\s+/g, " ").trim();
    let date = todayISO();
    if (/yesterday/i.test(raw)) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      date = d.toISOString().slice(0, 10);
    }
    merchant = merchant || "Untitled";
    const guess = cats.find((c) => merchant.toLowerCase().includes(c.name.toLowerCase().slice(0, 4)) && c.parent_id);
    await api.createTransaction({
      account_id: accountId || accounts[0]?.id,
      amount,
      occurred_at: date,
      merchant,
      category_id: guess?.id ?? null,
      direction: "debit",
    });
    setDraft("");
    await refresh();
  }

  const leaves = cats.filter((c) => c.parent_id);

  if (error) {
    return (
      <main style={{ maxWidth: 520, margin: "12vh auto", padding: "0 22px" }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Could not reach the API</h1>
        <p className="muted small" style={{ marginBottom: 16 }}>{error}</p>
        <p className="small muted">
          Static demo? Leave <code>NEXT_PUBLIC_API_URL</code> unset. Running locally? Start the
          FastAPI service in <code>backend/</code> first.
        </p>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <div className={s.strip}>
        <div className={s.stat}>
          <div className={s.lbl}>Spent this month</div>
          <div className={s.val}>{money(summary?.spent ?? 0)}</div>
          <div className={s.foot}>{summary?.count ?? 0} transactions</div>
        </div>
        <div className={s.stat}>
          <div className={s.lbl}>Income</div>
          <div className={s.val}>{money(summary?.income ?? 0)}</div>
          <div className={s.foot}>month to date</div>
        </div>
        <div className={s.stat}>
          <div className={s.lbl}>Net</div>
          <div className={`${s.val} ${(summary?.net ?? 0) < 0 ? s.neg : ""}`}>{money(summary?.net ?? 0)}</div>
          <div className={s.foot}>income minus spend</div>
        </div>
      </div>

      <form className={s.quick} onSubmit={quickAdd}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a transaction — try “320 swiggy yesterday”"
          aria-label="Quick add a transaction"
        />
        <button className="btn btn--sm" type="submit" disabled={!draft.trim()}>Add</button>
      </form>

      <div className={s.toolbar}>
        <div className={s.search}>
          <input placeholder="Search merchant or note" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={s.select} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button className="btn btn--ghost btn--sm" onClick={seed} disabled={busy}>
          {busy ? "Loading…" : "Load demo data"}
        </button>
      </div>

      <div className={s.ledger}>
        {groups.length === 0 && (
          <div className={s.empty}>
            <h3>Your ledger is empty</h3>
            <p>
              Add a transaction above, or load six months of believable demo data to see how the
              ledger behaves at volume.
            </p>
            <button className="btn btn--sm" onClick={seed} disabled={busy}>Load demo data</button>
          </div>
        )}

        {groups.map(([date, list]) => (
          <div key={date} className={s.day}>
            <div className={s.dayHd}>
              <b>{dayLabel(date)}</b>
              <span>{money(list.reduce((acc, t) => acc + (t.direction === "credit" ? t.amount : -t.amount), 0))}</span>
            </div>
            {list.map((t) => (
              <div key={t.id} className={s.tx}>
                <div className={s.mk}>{t.merchant.slice(0, 1).toUpperCase()}</div>
                <div className={s.main}>
                  <b>{t.merchant}</b>
                  <span>{t.source === "seed" ? "imported" : "manual"}</span>
                </div>
                <div className={s.cat}>
                  <select value={t.category_id ?? ""} onChange={(e) => recategorise(t.id, e.target.value)}>
                    <option value="">Uncategorised</option>
                    {leaves.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className={s.acct}>{t.account_name}</div>
                <div className={`${s.amt} ${t.direction === "credit" ? s.in : ""}`}>
                  {t.direction === "credit" ? "+" : "−"}{money(t.amount)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {isDemoMode() && (
        <p className={s.note}>
          Demo build — everything lives in this browser. Run the FastAPI service and set
          <code> NEXT_PUBLIC_API_URL </code> to use the real backend.
        </p>
      )}
    </main>
  );
}
