"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import type { BudgetStatus, BudgetSuggestion } from "@/lib/api";
import { statusLabel } from "@/lib/budgets";
import { money, parseRupees } from "@/lib/format";
import { ledgerHref, spendLink } from "@/lib/links";
import s from "./budgets.module.scss";

type Props = {
  budget: BudgetStatus;
  subtitle?: string;
  average: BudgetSuggestion | null;
  hero?: boolean;
  onUpdate: (body: { amount?: number; rollover?: boolean; fixed?: boolean }) => Promise<void>;
  onRemove: () => Promise<void>;
};

export default function BudgetCard({ budget, subtitle, average, hero = false, onUpdate, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [amount, setAmount] = useState(String((budget.allocated - budget.carried) / 100));
  const [rollover, setRollover] = useState(budget.rollover);
  const [fixed, setFixed] = useState(budget.fixed);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = ledgerHref(
    spendLink(budget.period_start, budget.period_end, budget.category_id ? { category: budget.category_id } : {}),
  );
  const over = budget.remaining < 0;
  const income = budget.category_kind === "income";

  async function save() {
    const paise = parseRupees(amount);
    if (!paise) {
      setError("Enter an amount above zero");
      return;
    }
    setBusy(true);
    try {
      await onUpdate({ amount: paise, rollover, fixed });
      setEditing(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (income) {
    return (
      <article className={`${s.card} ${s.over}`}>
        <header className={s.cardHead}>
          <div className={s.cardTitle}>
            <b>{budget.name}</b>
            {subtitle && <span>{subtitle}</span>}
          </div>
        </header>
        <p className={s.invalid}>
          {budget.category_name} is income, so nothing is ever spent against this budget, and it is left out of every
          total. Remove it; income is counted on the dashboard automatically.
        </p>
        <div className={s.actions}>
          <button type="button" onClick={() => void onRemove()}>
            Remove this budget
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className={`${hero ? s.hero : s.card} ${s[budget.status] ?? ""}`}>
      <header className={s.cardHead}>
        <div className={s.cardTitle}>
          <b>{budget.name}</b>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <span className={`${s.status} ${s[`st_${budget.status}`]}`}>{statusLabel(budget)}</span>
      </header>

      <div className={s.figures}>
        <span className={hero ? s.bigFigure : s.figure}>{money(budget.spent)}</span>
        <span className={s.of}>of {money(budget.allocated)}</span>
        <span className={s.pct}>{Math.round(budget.used_pct)}%</span>
      </div>

      <div className={s.pace} aria-label={`${budget.used_pct}% used, ${budget.elapsed_pct}% of the period gone`}>
        <div className={s.paceFill} style={{ width: `${Math.min(budget.used_pct, 100)}%` }} />
        {!budget.fixed && (
          <div className={s.paceMark} style={{ left: `${Math.min(budget.elapsed_pct, 100)}%` }} title="Today" />
        )}
      </div>

      <ul className={s.facts}>
        <li className={over ? s.factBad : undefined}>
          {over ? `${money(-budget.remaining)} over` : `${money(budget.remaining)} ${budget.fixed ? "still to pay" : "left"}`}
        </li>
        {budget.fixed && <li className={s.factDim}>fixed bill</li>}
        {!over && budget.daily_allowance > 0 && (
          <li>
            {money(budget.daily_allowance)}/day for {budget.days_left} {budget.days_left === 1 ? "day" : "days"}
          </li>
        )}
        {budget.projected !== null && budget.projected > budget.allocated && (
          <li className={s.factWarn}>on pace for {money(budget.projected)}</li>
        )}
        {budget.carried !== 0 && <li>{budget.carried > 0 ? `+${money(budget.carried)}` : money(budget.carried)} carried</li>}
        {average && <li className={s.factDim}>avg {money(average.average)} over the last {average.periods === 1 ? "period" : `${average.periods} periods`}</li>}
      </ul>

      {editing ? (
        <div className={s.editRow}>
          <label className={s.inline}>
            <span>Per period (₹)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
          </label>
          <label className={s.check}>
            <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
            Carry unspent forward
          </label>
          {budget.scope !== "overall" && (
            <label className={s.check}>
              <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
              Fixed bill
            </label>
          )}
          <Button size="sm" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {error && <span className={s.error}>{error}</span>}
        </div>
      ) : confirming ? (
        <div className={s.editRow}>
          <span className={s.confirmText}>Remove the {budget.name} budget? Transactions are not touched.</span>
          <Button size="sm" onClick={() => void onRemove()}>
            Remove
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <div className={s.actions}>
          <Link href={rows}>See the rows</Link>
          <button type="button" onClick={() => setEditing(true)}>
            Change
          </button>
          <button type="button" onClick={() => setConfirming(true)}>
            Remove
          </button>
        </div>
      )}
    </article>
  );
}
