"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import type { Category, Txn } from "@/lib/api";
import s from "./ledger.module.scss";

type Props = {
  transaction: Txn;
  categories: Category[];
  onRecategorise: (id: string, categoryId: string) => void;
  onOpen: (id: string) => void;
};

const TINT: Record<string, string> = { green: s.cGreen, clay: s.cClay, butter: s.cButter };

const SOURCE_LABEL: Record<string, string> = {
  import: "imported from a statement",
  seed: "demo data",
  manual: "added by hand",
  rule: "categorised by a rule",
};

export default function LedgerRow({ transaction, categories, onRecategorise, onOpen }: Props) {
  const [editing, setEditing] = useState(false);
  const incoming = transaction.direction === "credit";
  const category = categories.find((c) => c.id === transaction.category_id);
  const parent = category?.parent_id ? categories.find((c) => c.id === category.parent_id) : null;
  const leaves = categories.filter((c) => c.parent_id);
  const tint = category ? TINT[category.colour] ?? s.cGreen : s.cNone;

  return (
    <div
      className={s.row}
      role="row"
      tabIndex={0}
      onClick={() => onOpen(transaction.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(transaction.id);
        }
      }}
    >
      <div className={`${s.tile} ${tint}`} aria-hidden="true">
        {transaction.merchant.slice(0, 1).toUpperCase()}
      </div>

      <div className={s.main}>
        <b>
          {transaction.merchant}
          {transaction.needs_review && <i className={s.flag} title="The importer was unsure about this one" />}
        </b>
        <span title={transaction.note || parent?.name || SOURCE_LABEL[transaction.source]}>
          {transaction.note || parent?.name || SOURCE_LABEL[transaction.source] || "no description"}
        </span>
      </div>

      <div>
        {editing ? (
          <select
            className={s.chipSelect}
            autoFocus
            value={transaction.category_id ?? ""}
            onChange={(e) => {
              onRecategorise(transaction.id, e.target.value);
              setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            aria-label={`Category for ${transaction.merchant}`}
          >
            <option value="">Uncategorised</option>
            {leaves.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            className={`${s.chip} ${category ? tint : s.chipNone}`}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            title="Change category"
          >
            {category && <i style={{ background: "currentColor", opacity: 0.75 }} />}
            <span>{category?.name ?? "Uncategorised"}</span>
          </button>
        )}
      </div>

      <div className={s.account}>{transaction.account_name}</div>

      <div className={`${s.amount} ${incoming ? s.incoming : ""}`}>
        {incoming ? "+" : "−"}
        {money(transaction.amount)}
      </div>
    </div>
  );
}
