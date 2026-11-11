"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Summary, type Txn } from "@/lib/api";

export type LedgerFilters = { accountId: string; query: string };

export function useLedger() {
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LedgerFilters>({ accountId: "", query: "" });

  const reload = useCallback(async () => {
    try {
      const [rows, totals] = await Promise.all([api.transactions(), api.summary()]);
      setTransactions(rows);
      setSummary(totals);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    return transactions
      .filter((t) => !filters.accountId || t.account_id === filters.accountId)
      .filter((t) => !needle || t.merchant.toLowerCase().includes(needle));
  }, [transactions, filters]);

  /** Transactions grouped by day, newest day first — the shape the ledger renders. */
  const days = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const t of visible) {
      const bucket = map.get(t.occurred_at) ?? [];
      bucket.push(t);
      map.set(t.occurred_at, bucket);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visible]);

  const recategorise = useCallback(async (id: string, categoryId: string) => {
    const updated = await api.recategorise(id, categoryId);
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const add = useCallback(
    async (input: { accountId: string; amount: number; merchant: string; date: string; categoryId?: string | null }) => {
      await api.createTransaction({
        account_id: input.accountId,
        amount: input.amount,
        occurred_at: input.date,
        merchant: input.merchant,
        category_id: input.categoryId ?? null,
        direction: "debit",
      });
      await reload();
    },
    [reload],
  );

  const seed = useCallback(async () => {
    setLoading(true);
    try {
      await api.seedDemo();
      await reload();
    } finally {
      setLoading(false);
    }
  }, [reload]);

  return {
    transactions,
    visible,
    days,
    summary,
    loading,
    error,
    filters,
    setFilters,
    reload,
    recategorise,
    add,
    seed,
  };
}
