"use client";

import Link from "next/link";
import { money } from "@/lib/format";
import { ledgerHref, spendLink } from "@/lib/links";
import type { Dashboard } from "@/lib/api";
import s from "./dashboard.module.scss";

type Line = { label: string; value: number; href?: string; first?: boolean };

export default function HeroCard({ data }: { data: Dashboard }) {
  // The API plans against last period's income until salary lands, so rebuild that base from the identity.
  const base = data.free_to_spend + data.spent + data.committed + data.budgeted_remaining;
  const planned = data.income === 0 && base > 0;
  const spentPct = base > 0 ? Math.min((data.spent / base) * 100, 100) : 0;
  const elapsed = Math.min(data.elapsed_pct, 100);
  const ahead = spentPct > elapsed + 5;

  const period = { from: data.period_start, to: data.period_end };
  const lines: Line[] = [
    {
      label: planned ? "Expected income" : "Income",
      value: base,
      first: true,
      href: planned ? undefined : ledgerHref({ direction: "credit", transfers: "exclude", ...period }),
    },
    { label: "Spent so far", value: -data.spent, href: ledgerHref(spendLink(period.from, period.to)) },
    { label: "Bills still due", value: -data.committed, href: data.committed ? "#due" : undefined },
    { label: "Left in budgets", value: -data.budgeted_remaining, href: data.budgeted_remaining ? "/budgets/" : undefined },
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
        {lines.map(({ label, value, href, first }) => {
          const figure = value === 0 && !first ? "—" : money(value);
          return (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="num">
                {href ? (
                  <Link href={href} className={s.calcLink} title={`Open the rows behind ${label.toLowerCase()}`}>
                    {figure}
                  </Link>
                ) : (
                  figure
                )}
              </dd>
            </div>
          );
        })}
        <div className={s.calcTotal}>
          <dt>Free to spend</dt>
          <dd className="num">{money(data.free_to_spend)}</dd>
        </div>
      </dl>
    </div>
  );
}
