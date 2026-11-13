"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import CategoryPicker from "@/components/ui/CategoryPicker";
import { money } from "@/lib/format";
import type { Category, ReviewRow } from "@/lib/api";
import s from "./review.module.scss";

type Props = {
  rows: ReviewRow[];
  categories: Category[];
  selected: string[];
  busy: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onAssign: (categoryId: string, ids?: string[]) => void;
};

export default function ReviewQueue({ rows, categories, selected, busy, onToggle, onToggleAll, onAssign }: Props) {
  const [bulkCategory, setBulkCategory] = useState("");

  if (rows.length === 0) {
    return (
      <div className={s.panel}>
        <div className={s.empty}>
          Nothing to review. Every imported row was categorised with confidence — the queue fills up when a
          statement contains a merchant the seed list has never seen.
        </div>
      </div>
    );
  }

  return (
    <div className={s.panel}>
      <div className={s.head}>
        <h2>Needs a category</h2>
        <span>{rows.length} {rows.length === 1 ? "row" : "rows"}</span>
      </div>

      <div className={s.bulk}>
        <label className="small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            className={s.check}
            checked={selected.length === rows.length && rows.length > 0}
            onChange={onToggleAll}
            aria-label="Select all"
          />
          {selected.length > 0 ? `${selected.length} selected` : "Select all"}
        </label>

        <CategoryPicker
          categories={categories}
          value={bulkCategory}
          onChange={setBulkCategory}
          placeholder="Category for the selected rows…"
          aria-label="Category for the selected rows"
          size="sm"
          className={s.bulkPicker}
        />

        <Button
          size="sm"
          disabled={!bulkCategory || selected.length === 0 || busy}
          onClick={() => {
            onAssign(bulkCategory);
            setBulkCategory("");
          }}
        >
          Apply to {selected.length || 0}
        </Button>
      </div>

      <div className={s.list}>
        {rows.map((row) => (
          <div key={row.id} className={s.row}>
            <input
              type="checkbox"
              className={s.check}
              checked={selected.includes(row.id)}
              onChange={() => onToggle(row.id)}
              aria-label={`Select ${row.merchant}`}
            />

            <div className={s.main}>
              <b>{row.merchant}</b>
              <span title={row.note}>{row.note || "no description"}</span>
            </div>

            <div className={s.cat}>
              <CategoryPicker
                categories={categories}
                value={row.category_id ?? row.suggested_category_id ?? ""}
                emptyLabel="Uncategorised"
                size="sm"
                aria-label={`Category for ${row.merchant}`}
                onChange={(id) => onAssign(id, [row.id])}
              />
            </div>

            <div className={s.amount}>
              {row.direction === "credit" ? "+" : "−"}
              {money(row.amount)}
            </div>

            <div>
              {row.suggested_category_id && <span className={s.suggest}>suggested</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
