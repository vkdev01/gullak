"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { money } from "@/lib/format";
import s from "./page.module.scss";

export default function BudgetsPage() {
  const { statuses, create, loading, error } = useBudgets();
  const { leaves } = useCategories();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [rollover, setRollover] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const paise = Math.round(parseFloat(amount || "0") * 100);
    if (!paise) return;
    setBusy(true);
    try {
      await create({ category_id: categoryId || null, amount: paise, rollover });
      setAmount("");
      setCategoryId("");
      setRollover(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1>Budgets</h1>
        <p>
          A budget is a cap for a category in the current period. The fill is money spent; the marker is time elapsed.
          When the fill runs past the marker, you are spending faster than the month is passing.
        </p>
      </header>

      {error && <p className={s.error}>Could not load budgets: {error}</p>}

      <section className={s.list}>
        {loading && <p className="small muted">Loading…</p>}
        {!loading && statuses.length === 0 && (
          <p className={s.empty}>No budgets yet. Add one below — groceries and dining are the usual first two.</p>
        )}

        {statuses.map((budget) => (
          <div key={budget.id} className={`${s.row} ${s[budget.status] ?? ""}`}>
            <div className={s.rowMain}>
              <div className={s.rowTop}>
                <b>{budget.name}</b>
                <span>
                  {money(budget.spent)} of {money(budget.allocated)}
                  {budget.carried ? ` · incl. ${money(budget.carried)} carried` : ""}
                </span>
              </div>
              <div className={s.pace}>
                <div className={s.paceFill} style={{ width: `${Math.min(budget.used_pct, 100)}%` }} />
                <div className={s.paceMark} style={{ left: `${Math.min(budget.elapsed_pct, 100)}%` }} />
              </div>
              <div className={s.rowFoot}>
                <span>
                  {budget.used_pct}% used · {budget.elapsed_pct}% elapsed
                </span>
                <span>{budget.remaining >= 0 ? `${money(budget.remaining)} left` : `${money(-budget.remaining)} over`}</span>
              </div>
            </div>
            <div className={s.badge}>{budget.status.replace("_", " ")}</div>
          </div>
        ))}
      </section>

      <form className={s.form} onSubmit={submit}>
        <h2>New budget</h2>
        <div className={s.formRow}>
          <div className={s.selectWrap}>
            <label htmlFor="budget-cat">Category</label>
            <select id="budget-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Whole household (envelope)</option>
              {leaves.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Field label="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <label className={s.check}>
            <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
            Carry unspent forward
          </label>
          <Button type="submit" disabled={busy || !amount}>
            {busy ? "Saving…" : "Add budget"}
          </Button>
        </div>
      </form>
    </main>
  );
}
