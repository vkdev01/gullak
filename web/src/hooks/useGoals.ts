"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Goal } from "@/lib/api";

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setGoals(await api.goals());
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
    async (input: { name: string; target: number; monthly_target?: number | null }) => {
      await api.createGoal(input);
      await reload();
    },
    [reload],
  );

  const contribute = useCallback(
    async (goalId: string, amount: number) => {
      await api.contribute(goalId, amount);
      await reload();
    },
    [reload],
  );

  return { goals, loading, error, create, contribute, reload };
}
