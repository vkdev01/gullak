"use client";

import { money } from "@/lib/format";
import type { Category, Txn } from "@/lib/api";
import s from "./ledger.module.scss";

type Props = {
  transaction: Txn;
  categories: Category[];
  onRecategorise: (id: string, categoryId: string) => void;
};

const SOURCE_LABEL: Record<string, string> = {
  import: "imported",
  seed: "seeded",
  manual: "manual",
  rule: "rule",
};

export default function LedgerRow({ transaction, categories, onRecategorise }: Props) {
  const incoming = transaction.direction === "credit";
  const source = SOURCE_LABEL[transaction.source] ?? transaction.source;

  return (
    <div className={s.row}>
      <div className={s.monogram} aria-hidden="true">
        {transaction.merchant.slice(0, 1).toUpperCase()}
      </div>

      <div className={s.main}>
        <b>{transaction.merchant}</b>
        <span>{source}</span>
      </div>

      <div className={s.category}>
        <select
          value={transaction.category_id ?? ""}
          onChange={(e) => onRecategorise(transaction.id, e.target.value)}
          aria-label={`Category for ${transaction.merchant}`}
        >
          <option value="">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className={s.account}>{transaction.account_name}</div>

      <div className={`${s.amount} ${incoming ? s.incoming : ""}`}>
        {incoming ? "+" : "−"}
        {money(transaction.amount)}
      </div>
    </div>
  );
}
