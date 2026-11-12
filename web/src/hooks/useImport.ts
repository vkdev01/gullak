"use client";

import { useCallback, useState } from "react";
import { api, type ImportBatch, type ImportDecision, type ImportPreview } from "@/lib/api";

type Decision = { action: "import" | "skip"; category_id?: string | null };

/**
 * Two-phase import, mirrored from the API: preview builds candidate rows,
 * commit is the only path to the ledger. Decisions are kept per row so a
 * category change in the preview survives the commit call.
 */
export function useImport() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [result, setResult] = useState<ImportBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPreview = useCallback(async (accountId: string, csv: string, filename = "statement.csv") => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = await api.previewImport({ account_id: accountId, filename, csv });
      setPreview(body);
      setDecisions({});
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const setCategory = useCallback((rowId: string, categoryId: string) => {
    setDecisions((prev) => ({ ...prev, [rowId]: { action: "import", category_id: categoryId } }));
    setPreview((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r) => (r.id === rowId ? { ...r, category_id: categoryId } : r)),
          }
        : prev,
    );
  }, []);

  const skip = useCallback((rowId: string) => {
    setDecisions((prev) => ({ ...prev, [rowId]: { action: "skip" } }));
  }, []);

  const commit = useCallback(async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const payload: ImportDecision[] = Object.entries(decisions).map(([row_id, d]) => ({
        row_id,
        action: d.action,
        category_id: d.category_id ?? null,
      }));
      const batch = await api.commitImport(preview.batch.id, payload);
      setResult(batch);
      setPreview(null);
      setDecisions({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [preview, decisions]);

  const reset = useCallback(() => {
    setPreview(null);
    setDecisions({});
    setResult(null);
    setError(null);
  }, []);

  const willImport = preview
    ? preview.rows.filter((r) => !r.is_duplicate && decisions[r.id]?.action !== "skip").length
    : 0;

  return { preview, decisions, result, busy, error, runPreview, setCategory, skip, commit, reset, willImport };
}
