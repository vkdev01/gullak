"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Count, type Summary, type Txn } from "@/lib/api";
import { monthKey, monthRange, shiftMonth, todayISO } from "@/lib/format";

export type LedgerView = "all" | "review" | "uncategorised";
export type LedgerFilters = { accountId: string; query: string; view: LedgerView };

export const PAGE_SIZE = 50;
const THIS_MONTH = monthKey(todayISO());

/**
 * The ledger is a window, not a scroll: one month at a time, fifty rows a page.
 * Month and page live here so the list, the period band and the pagination
 * footer cannot disagree about what is on screen.
 */
export function useLedger() {
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [totals, setTotals] = useState<Count>({ count: 0, out: 0, income: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFiltersState] = useState<LedgerFilters>({ accountId: "", query: "", view: "all" });
  const [month, setMonthState] = useState<string>(THIS_MONTH);
  const [allTime, setAllTime] = useState(false);
  const [page, setPage] = useState(0);

  const paramsFor = useCallback(
    (withPaging = true) => {
      const range = allTime ? null : monthRange(month);
      return {
        ...(withPaging ? { limit: PAGE_SIZE, offset: page * PAGE_SIZE } : {}),
        ...(range ? { start: range.start, end: range.end } : {}),
        ...(filters.accountId ? { account_id: filters.accountId } : {}),
        ...(filters.query.trim() ? { q: filters.query.trim() } : {}),
        ...(filters.view === "review" ? { needs_review: true } : {}),
        ...(filters.view === "uncategorised" ? { uncategorised: true } : {}),
      };
    },
    [allTime, month, page, filters],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, counted, monthSummary] = await Promise.all([
        api.transactions(paramsFor()),
        api.count(paramsFor(false)),
        api.summary(),
      ]);
      setTransactions(rows);
      setTotals(counted);
      setSummary(monthSummary);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [paramsFor]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Any change to the window sends you back to page one. */
  const setFilters = useCallback((next: LedgerFilters) => {
    setFiltersState(next);
    setPage(0);
  }, []);

  const setMonth = useCallback((next: string) => {
    setMonthState(next);
    setAllTime(false);
    setPage(0);
  }, []);

  const showAllTime = useCallback(() => {
    setAllTime((prev) => !prev);
    setPage(0);
  }, []);

  const pageCount = Math.max(1, Math.ceil(totals.count / PAGE_SIZE));

  const days = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const t of transactions) {
      const bucket = map.get(t.occurred_at) ?? [];
      bucket.push(t);
      map.set(t.occurred_at, bucket);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [transactions]);

  const recategorise = useCallback(
    async (id: string, categoryId: string) => {
      const updated = await api.recategorise(id, categoryId);
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
    },
    [],
  );

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
    days,
    summary,
    totals,
    loading,
    error,
    filters,
    setFilters,
    month,
    allTime,
    setMonth,
    showAllTime,
    stepMonth: (delta: number) => setMonth(shiftMonth(month, delta)),
    isCurrentMonth: month === THIS_MONTH && !allTime,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    setPage,
    reload,
    recategorise,
    add,
    seed,
  };
}
