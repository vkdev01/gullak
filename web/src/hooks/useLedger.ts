"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Summary, type Txn } from "@/lib/api";

export type LedgerView = "all" | "review" | "uncategorised";
export type LedgerFilters = { accountId: string; query: string; view: LedgerView };

const PAGE_SIZE = 200;

export function useLedger() {
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LedgerFilters>({ accountId: "", query: "", view: "all" });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const paramsFor = useCallback(
    (offset: number) => ({
      limit: PAGE_SIZE,
      offset,
      ...(filters.accountId ? { account_id: filters.accountId } : {}),
      ...(filters.query.trim() ? { q: filters.query.trim() } : {}),
      ...(filters.view === "review" ? { needs_review: true } : {}),
      ...(filters.view === "uncategorised" ? { uncategorised: true } : {}),
    }),
    [filters],
  );

  const reload = useCallback(async () => {
    try {
      const [rows, totals] = await Promise.all([api.transactions(paramsFor(0)), api.summary()]);
      setTransactions(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setSummary(totals);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [paramsFor]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await api.transactions(paramsFor(transactions.length));
      setTransactions((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, paramsFor, transactions.length]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // The API already applied the filters; this only keeps the list honest if the
  // query changes while a page is in flight.
  const visible = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    return transactions
      .filter((t) => !filters.accountId || t.account_id === filters.accountId)
      .filter((t) => !needle || t.merchant.toLowerCase().includes(needle) || (t.note ?? "").toLowerCase().includes(needle))
      .filter((t) => filters.view !== "review" || t.needs_review)
      .filter((t) => filters.view !== "uncategorised" || !t.category_id);
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

  const totals = useMemo(() => {
    const out = visible.filter((t) => t.direction === "debit").reduce((sum, t) => sum + t.amount, 0);
    const income = visible.filter((t) => t.direction === "credit").reduce((sum, t) => sum + t.amount, 0);
    return { out, income, count: visible.length };
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
    totals,
    hasMore,
    loadingMore,
    loadMore,
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
