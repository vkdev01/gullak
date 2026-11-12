"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type BudgetStatus } from "@/lib/api";

export function useBudgets() {
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setStatuses(await api.budgetStatus());
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

  const create = useCallback(
    async (input: { category_id: string | null; amount: number; rollover?: boolean }) => {
      await api.createBudget(input);
      await reload();
    },
    [reload],
  );

  return { statuses, loading, error, create, reload };
}
