"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { useMoney } from "@/hooks/useMoney";
import { money } from "@/lib/format";
import { flowLink, ledgerHref, spendLink } from "@/lib/links";
import s from "@/components/money/money.module.scss";

export default function IncomePage() {
  const m = useMoney(6);
  const periods = m.summary?.periods ?? [];
  const now = periods[0];
  const sources = m.summary?.income_by_source ?? [];
  const max = sources[0]?.total ?? 1;
  const total = sources.reduce((sum, r) => sum + r.total, 0);
  const avgIncome = periods.length ? Math.round(periods.reduce((sum, p) => sum + p.income, 0) / periods.length) : 0;

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1>Income</h1>
        <p>
          Everything that came in: salary, bonus, freelance, interest, dividends, rent. Transfers between your own
          accounts and money taken back out of savings are not income. Add money in from the ledger with a plus sign,
          like <b>+85000 salary</b>, then give it an Income category.
        </p>
      </header>

      {m.missingDefaults && (
        <div className={s.banner}>
          <span>Add Bonus, Interest earned, Dividends and Rental income to your categories, plus savings categories.</span>
          <Button size="sm" onClick={() => void m.addDefaults()}>
            Add them
          </Button>
        </div>
      )}

      {now && (
        <section className={s.strip}>
          <Link href={ledgerHref(flowLink("income", now.period_start, now.period_end))} className={s.big}>
            <span>Income · {now.label}</span>
            <b>{money(now.income)}</b>
            <em>avg {money(avgIncome)} over {periods.length} periods</em>
          </Link>
          <Link href={ledgerHref(spendLink(now.period_start, now.period_end))}>
            <span>Spent</span>
            <b>{money(now.spent)}</b>
            <em>excludes savings and transfers</em>
          </Link>
          <Link href={ledgerHref(flowLink("invest", now.period_start, now.period_end))}>
            <span>Saved &amp; invested</span>
            <b>{money(now.invested)}</b>
            <em>{now.invest_rate != null ? `${now.invest_rate}% of income` : "—"}</em>
          </Link>
          <div>
            <span>Kept</span>
            <b className={now.saved < 0 ? s.neg : undefined}>{money(now.saved)}</b>
            <em>{now.savings_rate != null ? `${now.savings_rate}% savings rate` : "income minus spending"}</em>
          </div>
        </section>
      )}

      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2>Where it came from</h2>
          <span>this period</span>
        </div>
        {sources.length === 0 ? (
          <p className={s.empty}>No income recorded in this period yet.</p>
        ) : (
          <ol className={s.sources}>
            {sources.map((row) => (
              <li key={row.key}>
                <Link
                  href={ledgerHref(
                    flowLink(
                      "income",
                      now!.period_start,
                      now!.period_end,
                      row.key === "uncategorised" ? { view: "uncategorised" } : { category: row.key },
                    ),
                  )}
                >
                  <span>{row.label}</span>
                  <span className={s.bar} aria-hidden="true">
                    <i style={{ width: `${(row.total / max) * 100}%` }} />
                  </span>
                  <span className={s.share}>{total ? Math.round((row.total / total) * 100) : 0}%</span>
                  <span className={s.amount}>{money(row.total)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2>Period by period</h2>
          <span>kept = income − spent; saved is part of what you kept</span>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Period</th>
                <th>Income</th>
                <th>Spent</th>
                <th>Saved &amp; invested</th>
                <th>Kept</th>
                <th>Savings rate</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => (
                <tr key={p.period_start} className={i === 0 ? s.current : undefined}>
                  <td>{p.label}</td>
                  <td>
                    <Link href={ledgerHref(flowLink("income", p.period_start, p.period_end))}>{money(p.income)}</Link>
                  </td>
                  <td>
                    <Link href={ledgerHref(spendLink(p.period_start, p.period_end))}>{money(p.spent)}</Link>
                  </td>
                  <td>
                    <Link href={ledgerHref(flowLink("invest", p.period_start, p.period_end))}>{money(p.invested)}</Link>
                  </td>
                  <td className={p.saved < 0 ? s.neg : undefined}>{money(p.saved)}</td>
                  <td>{p.savings_rate != null ? `${p.savings_rate}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
