"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import type { ImportBatch } from "@/lib/api";
import s from "./import.module.scss";

export default function ImportResult({ batch, onReset }: { batch: ImportBatch; onReset: () => void }) {
  return (
    <div className={s.panel}>
      <div className={s.head}>
        <h2>3 · Done</h2>
        <span>{batch.filename}</span>
      </div>

      <div className={s.chips}>
        <span className={`${s.chip} ${s.ok}`}>{batch.imported_count} imported</span>
        <span className={`${s.chip} ${s.muted}`}>{batch.duplicate_count} skipped as duplicates</span>
        <span className={`${s.chip} ${s.warn}`}>{batch.review_count} to review</span>
      </div>

      <div className={s.foot}>
        <span className="small muted">
          {batch.review_count > 0
            ? "Rows the importer was not sure about are waiting in the review queue."
            : "Every row was categorised with confidence."}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <Link href="/review/">
            <Button variant="ghost" size="sm">
              Review queue
            </Button>
          </Link>
          <Link href="/">
            <Button size="sm">Open the ledger</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Import another
          </Button>
        </span>
      </div>
    </div>
  );
}
