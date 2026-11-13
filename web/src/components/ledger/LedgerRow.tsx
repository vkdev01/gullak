"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import CategoryPicker from "@/components/ui/CategoryPicker";
import { money } from "@/lib/format";
import { ledgerHref } from "@/lib/links";
import type { Category, Txn } from "@/lib/api";
import s from "./ledger.module.scss";

type Props = {
  transaction: Txn;
  categories: Category[];
  onRecategorise: (id: string, categoryId: string) => void;
  onOpen: (id: string) => void;
};

const TINT: Record<string, string> = { green: s.cGreen, clay: s.cClay, butter: s.cButter };

export default function LedgerRow({ transaction, categories, onRecategorise, onOpen }: Props) {
  const [editing, setEditing] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const incoming = transaction.direction === "credit";
  const category = categories.find((c) => c.id === transaction.category_id);
  const tint = category ? TINT[category.colour] ?? s.cGreen : s.cNone;

  const stopEditing = (refocus: boolean) => {
    setEditing(false);
    if (refocus) requestAnimationFrame(() => rowRef.current?.focus());
  };

  return (
    <div
      ref={rowRef}
      className={s.row}
      role="row"
      tabIndex={0}
      data-ledger-row=""
      onClick={() => onOpen(transaction.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " " || e.key === "o") {
          e.preventDefault();
          onOpen(transaction.id);
        } else if (e.key === "e") {
          e.preventDefault();
          setEditing(true);
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
        {transaction.note && <span title={transaction.note}>{transaction.note}</span>}
        {(transaction.tags ?? []).length > 0 && (
          <em className={s.rowTags}>
            {transaction.tags!.map((tag) => (
              <Link
                key={tag}
                href={ledgerHref({ tag, when: "all" })}
                onClick={(e) => e.stopPropagation()}
                title={`Every row tagged #${tag}`}
              >
                #{tag}
              </Link>
            ))}
          </em>
        )}
      </div>

      <div>
        {editing ? (
          // the picker's list is portalled, but React still bubbles its clicks to the row
          <div onClick={(e) => e.stopPropagation()}>
            <CategoryPicker
              categories={categories}
              value={transaction.category_id ?? ""}
              emptyLabel="Uncategorised"
              size="sm"
              autoFocus
              aria-label={`Category for ${transaction.merchant}`}
              onChange={(id) => {
                onRecategorise(transaction.id, id);
                stopEditing(true);
              }}
              onClose={() => stopEditing(false)}
            />
          </div>
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
