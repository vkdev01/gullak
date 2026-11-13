"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Account, type Category, type MoneySummary } from "@/lib/api";

/** Accounts, categories and the period-by-period money summary, reloaded together after any change. */
export function useMoney(periods = 6) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [a, c, s] = await Promise.all([api.accounts(), api.categories(), api.moneySummary(periods)]);
      setAccounts(a);
      setCategories(c);
      setSummary(s);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [periods]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    accounts,
    spending: accounts.filter((a) => a.kind !== "investment"),
    investments: accounts.filter((a) => a.kind === "investment"),
    categories,
    // households created before savings categories existed need a one-click backfill
    missingDefaults: !loading && !categories.some((c) => c.kind === "saving"),
    summary,
    loading,
    error,
    reload,
    addDefaults: async () => {
      await api.addDefaultCategories();
      await reload();
    },
  };
}
