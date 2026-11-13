"use client";

import Link from "next/link";
import AccountForm from "@/components/money/AccountForm";
import RemoveAccount from "@/components/money/RemoveAccount";
import { useMoney } from "@/hooks/useMoney";
import { ACCOUNT_TYPE_LABEL } from "@/lib/flows";
import { money } from "@/lib/format";
import { ledgerHref } from "@/lib/links";
import s from "@/components/money/money.module.scss";

export default function AccountsPage() {
  const m = useMoney(1);
  const sum = m.summary;

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1>Accounts</h1>
        <p>
          Bank accounts, cards, cash and wallets you spend from. Balances are the opening balance plus every row. Savings
          and investments live on their own page.
        </p>
      </header>

      {sum && (
        <section className={s.strip}>
          <div className={s.big}>
            <span>Net worth</span>
            <b className={sum.net_worth < 0 ? s.neg : undefined}>{money(sum.net_worth)}</b>
            <em>what you have, minus what you owe</em>
          </div>
          <div>
            <span>In the bank &amp; cash</span>
            <b>{money(sum.liquid)}</b>
          </div>
          <Link href="/savings/">
            <span>Savings &amp; investments</span>
            <b>{money(sum.investments)}</b>
            <em>open →</em>
          </Link>
          <div>
            <span>Owed on cards</span>
            <b className={sum.owed ? s.neg : undefined}>{money(sum.owed)}</b>
          </div>
        </section>
      )}

      {m.error && <p className={s.error}>Could not load accounts: {m.error}</p>}

      {!m.loading && m.spending.length === 0 ? (
        <p className={s.empty}>
          No accounts yet. Add the bank account your salary lands in: every transaction in the ledger belongs to an
          account.
        </p>
      ) : (
        <div className={s.list}>
          {m.spending.map((a) => (
            <div key={a.id} className={s.row}>
              <Link href={ledgerHref({ account: a.id, when: "all" })} className={s.grow}>
                <b>{a.name}</b>
                <span className={s.meta}>
                  {ACCOUNT_TYPE_LABEL[a.type] ?? a.type}
                  {a.institution ? ` · ${a.institution}` : ""}
                  {a.masked_number ? ` · ${a.masked_number}` : ""}
                </span>
              </Link>
              <span className={`num ${a.balance < 0 ? s.neg : ""}`}>{money(a.balance)}</span>
              <RemoveAccount account={a} onDone={() => void m.reload()} />
            </div>
          ))}
        </div>
      )}

      <AccountForm kind="spending" onCreated={() => void m.reload()} />
    </main>
  );
}
