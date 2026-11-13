"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import { useGoals } from "@/hooks/useGoals";
import { money } from "@/lib/format";
import s from "./page.module.scss";

export default function GoalsPage() {
  const { goals, create, contribute, remove, undoLast, loading, error } = useGoals();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setConfirmId(null);
    }
  }
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const targetPaise = Math.round(parseFloat(target || "0") * 100);
    if (!name.trim() || !targetPaise) return;
    setBusy(true);
    try {
      await create({
        name: name.trim(),
        target: targetPaise,
        monthly_target: monthly ? Math.round(parseFloat(monthly) * 100) : null,
      });
      setName("");
      setTarget("");
      setMonthly("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1>Goals</h1>
        <p>
          A goal is a target with a date. The projection comes from the monthly amount you commit to, not from hope —
          miss a month and the finish line moves.
        </p>
      </header>

      {error && <p className={s.error}>Could not load goals: {error}</p>}
      {actionError && <p className={s.error}>{actionError}</p>}

      <section className={s.list}>
        {loading && <p className="small muted">Loading…</p>}
        {!loading && goals.length === 0 && <p className={s.empty}>No goals yet. Start with an emergency fund.</p>}

        {goals.map((goal) => (
          <div key={goal.id} className={s.card}>
            <div className={s.top}>
              <div>
                <b>{goal.name}</b>
                <span>
                  {money(goal.contributed)} of {money(goal.target)} · {goal.progress_pct}%
                </span>
              </div>
              <span className={s.projection}>
                {goal.projected_finish ? `on pace for ${goal.projected_finish}` : "set a monthly amount for a date"}
              </span>
            </div>

            <div className={s.bar}>
              <i style={{ width: `${Math.min(goal.progress_pct, 100)}%` }} />
            </div>

            <div className={s.actions}>
              {[100000, 500000].map((amount) => (
                <Button
                  key={amount}
                  variant="ghost"
                  size="sm"
                  onClick={() => void run(() => contribute(goal.id, amount))}
                >
                  + {money(amount)}
                </Button>
              ))}
              {goal.contributed > 0 && (
                <Button variant="ghost" size="sm" onClick={() => void run(() => undoLast(goal.id))}>
                  Undo last
                </Button>
              )}
              {confirmId === goal.id ? (
                <>
                  <Button size="sm" onClick={() => void run(() => remove(goal.id))}>
                    Yes, delete goal
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmId(goal.id)}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>

      <form className={s.form} onSubmit={submit}>
        <h2>New goal</h2>
        <div className={s.formRow}>
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa trip" />
          <Field label="Target (₹)" value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
          <Field
            label="Monthly (₹)"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            inputMode="decimal"
            placeholder="optional"
          />
          <Button type="submit" disabled={busy || !name || !target}>
            {busy ? "Saving…" : "Add goal"}
          </Button>
        </div>
      </form>
    </main>
  );
}
