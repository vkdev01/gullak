"use client";

import { money } from "@/lib/format";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

export default function HeroCard({ data }: { data: Dashboard }) {
  // The API plans against last period's income until salary lands, so rebuild that base from the identity.
  const base = data.free_to_spend + data.spent + data.committed + data.budgeted_remaining;
  const planned = data.income === 0 && base > 0;
  const spentPct = base > 0 ? Math.min((data.spent / base) * 100, 100) : 0;
  const elapsed = Math.min(data.elapsed_pct, 100);
  const ahead = spentPct > elapsed + 5;

  const lines: [string, number][] = [
    [planned ? "Expected income" : "Income", base],
    ["Spent so far", -data.spent],
    ["Bills still due", -data.committed],
    ["Left in budgets", -data.budgeted_remaining],
  ];

  return (
    <div className={s.hero}>
      <div className={s.heroMain}>
        <div className={s.heroLabel}>Free to spend</div>
        <div className={`${s.heroValue} ${data.free_to_spend < 0 ? s.neg : ""}`}>{money(data.free_to_spend)}</div>
        <div className={s.heroSub}>
          {planned ? "Planned against last period's income until salary lands" : `${data.days_left} days left in the period`}
        </div>

        <div className={s.heroPace} aria-label={`${Math.round(spentPct)}% of income spent, ${Math.round(elapsed)}% of the period gone`}>
          <div className={s.pace}>
            <div className={`${s.paceFill} ${ahead ? s.paceAhead : ""}`} style={{ width: `${spentPct}%` }} />
            <div className={s.paceMark} style={{ left: `${elapsed}%` }} />
          </div>
          <div className={s.heroPaceText}>
            <span>{Math.round(spentPct)}% of income spent</span>
            <span>{Math.round(elapsed)}% of the period gone</span>
          </div>
        </div>
      </div>

      <dl className={s.calc} aria-label="How free to spend is calculated">
        {lines.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="num">{value === 0 && label !== lines[0][0] ? "—" : money(value)}</dd>
          </div>
        ))}
        <div className={s.calcTotal}>
          <dt>Free to spend</dt>
          <dd className="num">{money(data.free_to_spend)}</dd>
        </div>
      </dl>
    </div>
  );
}
