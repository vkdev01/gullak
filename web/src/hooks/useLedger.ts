"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Count, type Summary, type Txn } from "@/lib/api";
import { monthKey, monthRange, shiftMonth, todayISO } from "@/lib/format";
import type { LedgerLink } from "@/lib/links";

export type LedgerView = "all" | "review" | "uncategorised";
export type LedgerFilters = {
  accountId: string;
  categoryId: string;
  direction: "" | "debit" | "credit";
  excludeTransfers: boolean;
  flow: "" | "spend" | "income" | "invest" | "withdraw";
  query: string;
  tag: string;
  view: LedgerView;
};
export type DateRange = { start: string; end: string };

export const PAGE_SIZE = 50;
const THIS_MONTH = monthKey(todayISO());

export const EMPTY_FILTERS: LedgerFilters = {
  accountId: "",
  categoryId: "",
  direction: "",
  excludeTransfers: false,
  flow: "",
  query: "",
  tag: "",
  view: "all",
};

export const hasActiveFilters = (f: LedgerFilters) =>
  Boolean(f.categoryId || f.direction || f.excludeTransfers || f.flow || f.query.trim() || f.tag || f.view !== "all");

function filtersFrom(link: LedgerLink): LedgerFilters {
  return {
    accountId: link.account ?? "",
    categoryId: link.category ?? "",
    direction: link.direction ?? "",
    excludeTransfers: link.transfers === "exclude",
    flow: link.flow ?? "",
    query: link.q ?? "",
    tag: link.tag ?? "",
    view: link.view ?? "all",
  };
}

function rangeFrom(link: LedgerLink): DateRange | null {
  if (!link.from && !link.to) return null;
  return { start: link.from ?? link.to!, end: link.to ?? link.from! };
}

/**
 * The ledger is a window, not a scroll: one month (or a linked date range) at a
 * time, fifty rows a page. Window and page live here so the list, the period
 * band and the pagination footer cannot disagree about what is on screen.
 */
export function useLedger(link: LedgerLink = {}, linkKey = "") {
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [totals, setTotals] = useState<Count>({ count: 0, out: 0, income: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFiltersState] = useState<LedgerFilters>(() => filtersFrom(link));
  const [range, setRange] = useState<DateRange | null>(() => rangeFrom(link));
  const [month, setMonthState] = useState<string>(THIS_MONTH);
  const [allTime, setAllTime] = useState(() => link.when === "all" && !rangeFrom(link));
  const [page, setPage] = useState(0);

  // A new link while already on the page (command palette, back button) replaces the window.
  const appliedKey = useRef(linkKey);
  useEffect(() => {
    if (appliedKey.current === linkKey) return;
    appliedKey.current = linkKey;
    setFiltersState(filtersFrom(link));
    setRange(rangeFrom(link));
    setAllTime(link.when === "all" && !rangeFrom(link));
    setPage(0);
  }, [link, linkKey]);

  const paramsFor = useCallback(
    (withPaging = true) => {
      const span = range ?? (allTime ? null : monthRange(month));
      return {
        ...(withPaging ? { limit: PAGE_SIZE, offset: page * PAGE_SIZE } : {}),
        ...(span ? { start: span.start, end: span.end } : {}),
        ...(filters.accountId ? { account_id: filters.accountId } : {}),
        ...(filters.categoryId ? { category_id: filters.categoryId } : {}),
        ...(filters.direction ? { direction: filters.direction } : {}),
        ...(filters.excludeTransfers ? { exclude_transfers: true } : {}),
        ...(filters.flow ? { flow: filters.flow } : {}),
        ...(filters.query.trim() ? { q: filters.query.trim() } : {}),
        ...(filters.tag ? { tag: filters.tag } : {}),
        ...(filters.view === "review" ? { needs_review: true } : {}),
        ...(filters.view === "uncategorised" ? { uncategorised: true } : {}),
      };
    },
    [range, allTime, month, page, filters],
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
    setRange(null);
    setAllTime(false);
    setPage(0);
  }, []);

  const showAllTime = useCallback(() => {
    setRange(null);
    setAllTime((prev) => !prev);
    setPage(0);
  }, []);

  const clearRange = useCallback(() => {
    setRange(null);
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
    async (input: {
      accountId: string;
      amount: number;
      direction?: "debit" | "credit";
      merchant: string;
      date: string;
      note?: string;
      tags?: string[];
      categoryId?: string | null;
    }) => {
      const created = await api.createTransaction({
        account_id: input.accountId,
        amount: input.amount,
        occurred_at: input.date,
        merchant: input.merchant,
        note: input.note ?? "",
        tags: input.tags ?? [],
        category_id: input.categoryId ?? null,
        direction: input.direction ?? "debit",
      });
      setPage(0);
      await reload();
      return created;
    },
    [reload],
  );

  /** A row added for another month would vanish from view, so move the window to it. */
  const reveal = useCallback(
    (date: string) => {
      if (range && (date < range.start || date > range.end)) setRange(null);
      if (!allTime && !range && monthKey(date) !== month) setMonthState(monthKey(date));
      setPage(0);
    },
    [allTime, month, range],
  );

  const remove = useCallback(
    async (ids: string[]) => {
      const { deleted } = await api.deleteTransactions(ids);
      await reload();
      return deleted;
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
    range,
    clearRange,
    setMonth,
    showAllTime,
    stepMonth: (delta: number) => setMonth(shiftMonth(range ? monthKey(range.start) : month, delta)),
    goToThisMonth: () => setMonth(THIS_MONTH),
    isCurrentMonth: month === THIS_MONTH && !allTime && !range,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    setPage,
    reload,
    recategorise,
    add,
    reveal,
    remove,
    seed,
  };
}
