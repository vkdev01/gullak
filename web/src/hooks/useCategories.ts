"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Category } from "@/lib/api";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setCategories(await api.categories());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Leaf categories are the ones a transaction can point at. */
  const leaves = useMemo(() => categories.filter((c) => c.parent_id), [categories]);

  return { categories, leaves, loading, reload };
}
