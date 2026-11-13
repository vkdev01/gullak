"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isDemoMode } from "@/lib/api";
import { money, monthLabel, todayISO } from "@/lib/format";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useLedger } from "@/hooks/useLedger";
import LedgerList from "@/components/ledger/LedgerList";
import LedgerToolbar from "@/components/ledger/LedgerToolbar";
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

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Ledger</h1>
          <p className={s.sub}>
            {monthLabel(todayISO())} · every row, in order, with where it came from
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
          <span className={s.periodLabel}>Spent this month</span>
          <span className={s.periodValue}>{money(ledger.summary?.spent ?? 0)}</span>
        </div>
        <div className={s.periodSide}>
          <div>
            <span className={s.periodLabel}>In</span>
            <span className={s.periodSmall}>{money(ledger.summary?.income ?? 0)}</span>
          </div>
          <div>
            <span className={s.periodLabel}>Net</span>
            <span className={`${s.periodSmall} ${(ledger.summary?.net ?? 0) < 0 ? s.neg : ""}`}>
              {money(ledger.summary?.net ?? 0)}
            </span>
          </div>
          <div>
            <span className={s.periodLabel}>Entries</span>
            <span className={s.periodSmall}>{ledger.summary?.count ?? 0}</span>
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

      <LedgerList
        days={ledger.days}
        categories={categories}
        view={ledger.filters.view}
        hasAny={ledger.transactions.length > 0}
        total={ledger.totals.count}
        out={ledger.totals.out}
        income={ledger.totals.income}
        selectedId={null}
        hasMore={ledger.hasMore}
        loadingMore={ledger.loadingMore}
        onSelect={() => {}}
        onRecategorise={ledger.recategorise}
        onLoadMore={ledger.loadMore}
        onSeed={seed}
        seeding={seeding}
      />

      {isDemoMode() && (
        <p className={s.note}>
          Demo build — everything lives in this browser. Set <code>NEXT_PUBLIC_API_URL</code> to use the real backend.
        </p>
      )}
    </main>
  );
}
