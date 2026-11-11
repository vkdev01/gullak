"use client";

import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import type { Category, Txn } from "@/lib/api";
import DayGroup from "./DayGroup";
import s from "./ledger.module.scss";

type Props = {
  days: [string, Txn[]][];
  categories: Category[];
  hasTransactions: boolean;
  onRecategorise: (id: string, categoryId: string) => void;
  onSeed: () => void;
  seeding: boolean;
};

export default function LedgerList({ days, categories, hasTransactions, onRecategorise, onSeed, seeding }: Props) {
  if (days.length === 0) {
    return (
      <div className={s.list}>
        <EmptyState
          title={hasTransactions ? "Nothing matches those filters" : "Your ledger is empty"}
          action={
            <Button size="sm" onClick={onSeed} disabled={seeding}>
              {seeding ? "Loading…" : "Load demo data"}
            </Button>
          }
        >
          {hasTransactions
            ? "Try clearing the search or picking a different account."
            : "Add a transaction above, or load six months of believable demo data to see how the ledger behaves at volume."}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={s.list}>
      {days.map(([date, list]) => (
        <DayGroup
          key={date}
          date={date}
          transactions={list}
          categories={categories}
          onRecategorise={onRecategorise}
        />
      ))}
    </div>
  );
}
