"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type BudgetStatus, type BudgetSuggestion, type Household } from "@/lib/api";

export function useBudgets() {
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [rows, suggested, home] = await Promise.all([api.budgetStatus(), api.budgetSuggestions(), api.household()]);
      setStatuses(rows);
      setSuggestions(suggested);
      setHousehold(home);
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

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      await action();
      await reload();
    },
    [reload],
  );

  const averageFor = useMemo(() => {
    const map = new Map(suggestions.map((s) => [s.category_id, s]));
    return (categoryId: string | null) => map.get(categoryId) ?? null;
  }, [suggestions]);

  return {
    statuses,
    overall: statuses.find((b) => b.scope === "overall") ?? null,
    categoryBudgets: statuses.filter((b) => b.scope !== "overall"),
    household,
    averageFor,
    loading,
    error,
    reload,
    create: (input: { category_id: string | null; amount: number; rollover?: boolean; fixed?: boolean }) =>
      run(() => api.createBudget(input)),
    update: (id: string, body: { amount?: number; rollover?: boolean; fixed?: boolean }) =>
      run(() => api.updateBudget(id, body)),
    remove: (id: string) => run(() => api.deleteBudget(id)),
    setCycleDay: (day: number) => run(() => api.updateHousehold({ cycle_start_day: day })),
  };
}
