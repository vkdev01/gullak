"use client";

import { money } from "@/lib/format";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

export default function HeroCard({ data }: { data: Dashboard }) {
  const allocated = data.budgets.reduce((sum, b) => sum + b.allocated, 0);
  const spentInBudgets = data.budgets.reduce((sum, b) => sum + b.spent, 0);
  const usedPct = allocated ? Math.round((spentInBudgets / allocated) * 100) : Math.round(data.elapsed_pct);

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(usedPct, 100) / 100) * circumference;

  return (
    <div className={s.hero}>
      <div className={s.orb} aria-hidden="true" />
      <div>
        <div className={s.heroLabel}>Free to spend · {data.period_label}</div>
        <div className={s.heroValue}>{money(data.free_to_spend)}</div>
        <div className={s.heroSub}>
          {money(data.committed)} committed · {money(data.budgeted_remaining)} left in budgets · {data.days_left} days
          left
        </div>
        <div className={s.heroMeta}>
          <span>
            In <b>{money(data.income)}</b>
          </span>
          <span>
            Out <b>{money(data.spent)}</b>
          </span>
        </div>
      </div>

      <div className={s.ring} aria-label={`${usedPct}% of budgets used`}>
        <svg viewBox="0 0 104 104">
          <circle cx="52" cy="52" r={radius} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="9" />
          <circle
            cx="52"
            cy="52"
            r={radius}
            fill="none"
            stroke="#fff"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
        </svg>
        <div className={s.ringInner}>
          <b>{usedPct}%</b>
          <span>budgets used</span>
        </div>
      </div>
    </div>
  );
}
