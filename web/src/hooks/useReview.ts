"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ReviewRow } from "@/lib/api";

export function useReview() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.review());
      setSelected([]);
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

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.length === rows.length ? [] : rows.map((r) => r.id)));
  }, [rows]);

  const assign = useCallback(
    async (categoryId: string, ids?: string[]) => {
      const target = ids ?? selected;
      if (target.length === 0) return;
      setBusy(true);
      try {
        await api.bulkCategorise(target, categoryId);
        await reload();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [selected, reload],
  );

  return { rows, selected, loading, busy, error, toggle, toggleAll, assign, reload };
}
