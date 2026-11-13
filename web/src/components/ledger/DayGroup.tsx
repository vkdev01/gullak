"use client";

import { dayLabel, money } from "@/lib/format";
import type { Category, Txn } from "@/lib/api";
import LedgerRow from "./LedgerRow";
import s from "./ledger.module.scss";

type Props = {
  date: string;
  transactions: Txn[];
  categories: Category[];
  onRecategorise: (id: string, categoryId: string) => void;
};

export default function DayGroup({ date, transactions, categories, onRecategorise }: Props) {
  const net = transactions.reduce((acc, t) => acc + (t.direction === "credit" ? t.amount : -t.amount), 0);
  const count = transactions.length;

  return (
    <div className={s.day}>
      <div className={s.dayHead}>
        <b>{dayLabel(date)}</b>
        <em>
          {count} {count === 1 ? "entry" : "entries"}
        </em>
        <span className={s.dayNet}>{money(net)}</span>
      </div>

      {transactions.map((t) => (
        <LedgerRow
          key={t.id}
          transaction={t}
          categories={categories}
          onRecategorise={onRecategorise}
        />
      ))}
    </div>
  );
}
