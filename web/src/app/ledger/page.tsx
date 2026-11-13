"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isDemoMode } from "@/lib/api";
import { money, monthLabelFromKey } from "@/lib/format";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useLedger } from "@/hooks/useLedger";
import LedgerList from "@/components/ledger/LedgerList";
import LedgerToolbar from "@/components/ledger/LedgerToolbar";
import Pagination from "@/components/ledger/Pagination";
import PeriodNav from "@/components/ledger/PeriodNav";
import QuickAddBar from "@/components/ledger/QuickAddBar";
import Button from "@/components/ui/Button";
import s from "./page.module.scss";

export default function LedgerPage() {
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const ledger = useLedger();
  const [seeding, setSeeding] = useState(false);

  const reviewCount = useMemo(() => ledger.transactions.filter((t) => t.needs_review).length, [ledger.transactions]);

  async function seed() {
    setSeeding(true);
    try {
      await ledger.seed();
    } finally {
      setSeeding(false);
    }
  }

  if (ledger.error) {
    return (
      <main className={s.page}>
        <h1 className={s.title}>Ledger</h1>
        <p className="muted small" style={{ fontFamily: "var(--mono)" }}>
          {ledger.error}
        </p>
      </main>
    );
  }

  const periodLabel = ledger.allTime ? "All time" : monthLabelFromKey(ledger.month);

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Ledger</h1>
          <p className={s.sub}>
            {periodLabel} · {ledger.totals.count} {ledger.totals.count === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className={s.actions}>
          <Link href="/import/">
            <Button variant="ghost" size="sm">
              Import a statement
            </Button>
          </Link>
        </div>
      </header>

      <section className={s.period}>
        <div className={s.periodMain}>
          <span className={s.periodLabel}>Spent · {periodLabel}</span>
          <span className={s.periodValue}>{money(ledger.totals.out)}</span>
        </div>
        <div className={s.periodSide}>
          <div>
            <span className={s.periodLabel}>In</span>
            <span className={s.periodSmall}>{money(ledger.totals.income)}</span>
          </div>
          <div>
            <span className={s.periodLabel}>Net</span>
            <span className={`${s.periodSmall} ${ledger.totals.net < 0 ? s.neg : ""}`}>{money(ledger.totals.net)}</span>
          </div>
          <div>
            <span className={s.periodLabel}>Entries</span>
            <span className={s.periodSmall}>{ledger.totals.count}</span>
          </div>
        </div>
      </section>

      <QuickAddBar
        onAdd={({ amount, merchant, date }) =>
          ledger.add({ accountId: ledger.filters.accountId || accounts[0]?.id, amount, merchant, date })
        }
      />

      <LedgerToolbar
        accounts={accounts}
        filters={ledger.filters}
        reviewCount={reviewCount}
        onFiltersChange={ledger.setFilters}
        onSeed={seed}
        seeding={seeding}
      />

      <PeriodNav
        month={ledger.month}
        allTime={ledger.allTime}
        isCurrentMonth={ledger.isCurrentMonth}
        onStep={ledger.stepMonth}
        onThisMonth={() => ledger.setMonth(ledger.month)}
        onToggleAllTime={ledger.showAllTime}
      />

      <LedgerList
        days={ledger.days}
        categories={categories}
        view={ledger.filters.view}
        hasAny={ledger.transactions.length > 0}
        loading={ledger.loading}
        total={ledger.totals.count}
        out={ledger.totals.out}
        income={ledger.totals.income}
        onRecategorise={ledger.recategorise}
        onSeed={seed}
        seeding={seeding}
      />

      <Pagination
        page={ledger.page}
        pageCount={ledger.pageCount}
        pageSize={ledger.pageSize}
        total={ledger.totals.count}
        onPage={ledger.setPage}
      />

      {isDemoMode() && (
        <p className={s.note}>
          Demo build — everything lives in this browser. Set <code>NEXT_PUBLIC_API_URL</code> to use the real backend.
        </p>
      )}
    </main>
  );
}
