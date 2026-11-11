"use client";

import { useState } from "react";
import { isDemoMode } from "@/lib/api";
import { money } from "@/lib/format";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useLedger } from "@/hooks/useLedger";
import LedgerList from "@/components/ledger/LedgerList";
import LedgerToolbar from "@/components/ledger/LedgerToolbar";
import QuickAddBar from "@/components/ledger/QuickAddBar";
import StatCard from "@/components/ui/StatCard";
import s from "./page.module.scss";

export default function LedgerPage() {
  const { accounts } = useAccounts();
  const { leaves } = useCategories();
  const ledger = useLedger();
  const [seeding, setSeeding] = useState(false);

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
        <h1 className={s.errorTitle}>Could not reach the API</h1>
        <p className="muted small">{ledger.error}</p>
        <p className={`small muted ${s.hint}`}>
          Static demo? Leave <code>NEXT_PUBLIC_API_URL</code> unset. Running locally? Start the FastAPI
          service in <code>api/</code> first.
        </p>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <section className={s.strip}>
        <StatCard
          label="Spent this month"
          value={money(ledger.summary?.spent ?? 0)}
          foot={`${ledger.summary?.count ?? 0} transactions`}
        />
        <StatCard label="Income" value={money(ledger.summary?.income ?? 0)} foot="month to date" />
        <StatCard
          label="Net"
          value={money(ledger.summary?.net ?? 0)}
          foot="income minus spend"
          negative={(ledger.summary?.net ?? 0) < 0}
        />
      </section>

      <QuickAddBar
        onAdd={({ amount, merchant, date }) =>
          ledger.add({ accountId: ledger.filters.accountId || accounts[0]?.id, amount, merchant, date })
        }
      />

      <LedgerToolbar
        accounts={accounts}
        filters={ledger.filters}
        onFiltersChange={ledger.setFilters}
        onSeed={seed}
        seeding={seeding}
      />

      <LedgerList
        days={ledger.days}
        categories={leaves}
        hasTransactions={ledger.transactions.length > 0}
        onRecategorise={ledger.recategorise}
        onSeed={seed}
        seeding={seeding}
      />

      {isDemoMode() && (
        <p className={s.note}>
          Demo build — everything lives in this browser. Run the FastAPI service and set
          <code> NEXT_PUBLIC_API_URL </code> to use the real backend.
        </p>
      )}
    </main>
  );
}
