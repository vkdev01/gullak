"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { api, type ImportBatch } from "@/lib/api";
import s from "./import.module.scss";

export default function ImportResult({ batch, onReset }: { batch: ImportBatch; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [undone, setUndone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function undo() {
    setBusy(true);
    setError(null);
    try {
      const { deleted } = await api.undoImport(batch.id);
      setUndone(deleted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className={s.panel}>
      <div className={s.head}>
        <h2>3 · Done</h2>
        <span>{batch.filename}</span>
      </div>

      <div className={s.chips}>
        {undone === null ? (
          <>
            <span className={`${s.chip} ${s.ok}`}>{batch.imported_count} imported</span>
            <span className={`${s.chip} ${s.muted}`}>{batch.duplicate_count} skipped as duplicates</span>
            <span className={`${s.chip} ${s.warn}`}>{batch.review_count} to review</span>
          </>
        ) : (
          <span className={`${s.chip} ${s.muted}`}>
            Import undone: {undone} {undone === 1 ? "entry" : "entries"} removed
          </span>
        )}
      </div>

      {error && (
        <p className="small" role="alert">
          {error}
        </p>
      )}

      <div className={s.foot}>
        <span className="small muted">
          {undone !== null
            ? "Nothing from this file is left in the ledger."
            : batch.review_count > 0
              ? "Rows the importer was not sure about are waiting in the review queue."
              : "Every row was categorised with confidence."}
        </span>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {undone === null && (
            <>
              {confirming ? (
                <>
                  <Button size="sm" onClick={() => void undo()} disabled={busy}>
                    {busy ? "Removing…" : `Remove all ${batch.imported_count}`}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Keep them
                  </Button>
                </>
              ) : (
                batch.imported_count > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                    Undo this import
                  </Button>
                )
              )}
              <Link href="/review/">
                <Button variant="ghost" size="sm">
                  Review queue
                </Button>
              </Link>
              <Link href="/ledger/">
                <Button size="sm">Open the ledger</Button>
              </Link>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onReset}>
            Import another
          </Button>
        </span>
      </div>
    </div>
  );
}
