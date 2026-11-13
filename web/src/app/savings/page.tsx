"use client";

import Link from "next/link";
import AccountForm from "@/components/money/AccountForm";
import SavingsCard from "@/components/money/SavingsCard";
import Button from "@/components/ui/Button";
import { useMoney } from "@/hooks/useMoney";
import { ACCOUNT_TYPE_LABEL } from "@/lib/flows";
import { money } from "@/lib/format";
import { flowLink, ledgerHref } from "@/lib/links";
import s from "@/components/money/money.module.scss";

const ORDER = ["epf", "ppf", "nps", "fd", "rd", "mutual_fund", "stocks", "gold", "other_investment"];

export default function SavingsPage() {
  const m = useMoney(6);
  const now = m.summary?.periods[0];
  const totalValue = m.investments.reduce((sum, a) => sum + (a.value ?? a.balance), 0);
  const totalIn = m.investments.reduce((sum, a) => sum + a.balance, 0);
  const due = m.investments.reduce(
    (sum, a) => sum + Math.max((a.monthly_amount ?? 0) - (a.contributed_this_period ?? 0), 0),
    0,
  );
  const types = ORDER.filter((t) => m.investments.some((a) => a.type === t));

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1>Savings &amp; investments</h1>
        <p>
          EPF, PPF, NPS, FDs, RDs, mutual funds, stocks and gold. Money moved here is saved, not spent: it never counts
          against a budget, and taking it back out is not income. Record what you put in; update the market value when
          you check your statement.
        </p>
      </header>

      {m.missingDefaults && (
        <div className={s.banner}>
          <span>
            Your categories predate savings tracking. Add “Savings &amp; investments” (SIP, FD, RD, PPF, EPF, NPS…) and
            more income sources, so an imported SIP debit is counted as saved rather than spent.
          </span>
          <Button size="sm" onClick={() => void m.addDefaults()}>
            Add them
          </Button>
        </div>
      )}

      <section className={s.strip}>
        <div className={s.big}>
          <span>Worth today</span>
          <b>{money(totalValue)}</b>
          <em>
            {totalValue !== totalIn
              ? `${totalValue >= totalIn ? "+" : ""}${money(totalValue - totalIn)} on ${money(totalIn)} put in`
              : `${m.investments.length} ${m.investments.length === 1 ? "account" : "accounts"}`}
          </em>
        </div>
        {now && (
          <Link href={ledgerHref(flowLink("invest", now.period_start, now.period_end))}>
            <span>Saved this period</span>
            <b>{money(now.invested)}</b>
            <em>{now.invest_rate != null ? `${now.invest_rate}% of income` : "no income yet this period"}</em>
          </Link>
        )}
        <div>
          <span>Still due this period</span>
          <b className={due ? s.neg : undefined}>{money(due)}</b>
          <em>planned RD / SIP / PPF instalments</em>
        </div>
        {now && now.withdrawn > 0 && (
          <Link href={ledgerHref(flowLink("withdraw", now.period_start, now.period_end))}>
            <span>Taken out</span>
            <b>{money(now.withdrawn)}</b>
            <em>this period</em>
          </Link>
        )}
      </section>

      {m.error && <p className={s.error}>Could not load: {m.error}</p>}

      {!m.loading && m.investments.length === 0 && (
        <p className={s.empty}>
          Nothing here yet. Add your EPF first: it is usually the largest, and it never shows up in a bank statement.
        </p>
      )}

      {types.map((type) => (
        <section key={type} className={s.section}>
          <div className={s.sectionHead}>
            <h2>{ACCOUNT_TYPE_LABEL[type]}</h2>
            <span className="num">
              {money(m.investments.filter((a) => a.type === type).reduce((sum, a) => sum + (a.value ?? a.balance), 0))}
            </span>
          </div>
          <div className={s.savings}>
            {m.investments
              .filter((a) => a.type === type)
              .map((account) => (
                <SavingsCard
                  key={`${account.id}-${account.balance}-${account.value}`}
                  account={account}
                  spendingAccounts={m.spending}
                  onChanged={() => void m.reload()}
                />
              ))}
          </div>
        </section>
      ))}

      <AccountForm kind="investment" onCreated={() => void m.reload()} />
    </main>
  );
}
