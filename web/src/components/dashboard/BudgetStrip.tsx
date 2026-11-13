"use client";

import Link from "next/link";
import { money } from "@/lib/format";
import { ledgerHref, spendLink } from "@/lib/links";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

export default function BudgetStrip({ data }: { data: Dashboard }) {
  return (
    <div className={s.card}>
      <div className={s.head}>
        <h2>Budgets</h2>
        <Link href="/budgets/">Manage →</Link>
      </div>

      {data.budgets.length === 0 ? (
        <p className={s.empty}>
          No budgets yet. Set one per category and this row becomes a pace board — where the marker is time elapsed,
          the fill is money spent.
        </p>
      ) : (
        <div className={s.budgets}>
          {data.budgets.slice(0, 6).map((budget) => (
            <Link
              key={budget.id}
              href={ledgerHref(
                spendLink(budget.period_start, budget.period_end, budget.category_id ? { category: budget.category_id } : {}),
              )}
              className={`${s.budget} ${s[budget.status] ?? ""}`}
              title={`Open the rows behind ${budget.name}`}
            >
              <div className={s.budgetTop}>
                <b>{budget.name}</b>
                <span>{budget.used_pct}%</span>
              </div>
              <div className={s.budgetValue}>{money(Math.max(budget.remaining, 0))} left</div>
              <div className={s.pace}>
                <div className={s.paceFill} style={{ width: `${Math.min(budget.used_pct, 100)}%` }} />
                <div className={s.paceMark} style={{ left: `${Math.min(budget.elapsed_pct, 100)}%` }} />
              </div>
              <div className={s.budgetFoot}>
                <span>{money(budget.spent)} spent</span>
                <span>{budget.elapsed_pct}% elapsed</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
