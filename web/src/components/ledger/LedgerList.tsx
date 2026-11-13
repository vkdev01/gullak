"use client";

import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { money } from "@/lib/format";
import type { Category, Txn } from "@/lib/api";
import type { LedgerView } from "@/hooks/useLedger";
import DayGroup from "./DayGroup";
import s from "./ledger.module.scss";

type Props = {
  days: [string, Txn[]][];
  categories: Category[];
  view: LedgerView;
  hasAny: boolean;
  total: number;
  out: number;
  income: number;
  selectedId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onSelect: (id: string) => void;
  onRecategorise: (id: string, categoryId: string) => void;
  onLoadMore: () => void;
  onSeed: () => void;
  seeding: boolean;
};

const EMPTY: Record<LedgerView, { title: string; body: string }> = {
  all: {
    title: "Your ledger is empty",
    body: "Add a transaction above, or load six months of believable demo data to see how the ledger behaves at volume.",
  },
  review: {
    title: "Nothing needs a look",
    body: "Every imported row was categorised with confidence. Rows land here when the importer meets a merchant it does not recognise.",
  },
  uncategorised: {
    title: "Everything has a category",
    body: "No row is sitting without one. Uncategorised entries show up here after an import the importer could not place.",
  },
};

export default function LedgerList({
  days,
  categories,
  view,
  hasAny,
  total,
  out,
  income,
  selectedId,
  hasMore,
  loadingMore,
  onSelect,
  onRecategorise,
  onLoadMore,
  onSeed,
  seeding,
}: Props) {
  if (days.length === 0) {
    const copy = EMPTY[view];
    return (
      <div className={s.list}>
        <div className={s.empty}>
          <EmptyState
            title={hasAny && view === "all" ? "Nothing matches those filters" : copy.title}
            action={
              view === "all" && !hasAny ? (
                <Button size="sm" onClick={onSeed} disabled={seeding}>
                  {seeding ? "Loading…" : "Load demo data"}
                </Button>
              ) : undefined
            }
          >
            {hasAny && view === "all" ? "Try clearing the search or picking a different account." : copy.body}
          </EmptyState>
        </div>
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
          selectedId={selectedId}
          onSelect={onSelect}
          onRecategorise={onRecategorise}
        />
      ))}

      <div className={s.count}>
        <span>
          {total} {total === 1 ? "entry" : "entries"}
        </span>
        <span>
          out {money(out)} · in {money(income)}
        </span>
      </div>

      {hasMore && (
        <div className={s.more}>
          <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
