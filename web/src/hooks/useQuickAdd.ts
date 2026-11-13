"use client";

import { useMemo, useState } from "react";
import { parseQuickAdd } from "@/lib/parse";

export type QuickAddInput = {
  amount: number;
  direction: "debit" | "credit";
  merchant: string;
  date: string;
  note: string;
  tags: string[];
};

/**
 * Draft state for the one-line capture bar. The parse is recomputed as you type
 * so the UI can show what will be saved before you press enter.
 */
export function useQuickAdd(onSubmit: (parsed: QuickAddInput) => Promise<void>) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => parseQuickAdd(draft), [draft]);

  async function submit() {
    if (!parsed.amount) return;
    setSubmitting(true);
    try {
      await onSubmit({
        amount: parsed.amount,
        direction: parsed.direction,
        merchant: parsed.merchant,
        date: parsed.date,
        note: parsed.note,
        tags: parsed.tags,
      });
      setDraft("");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return {
    draft,
    setDraft: (next: string) => {
      setDraft(next);
      setError(null);
    },
    parsed,
    submit,
    submitting,
    error,
    ready: Boolean(parsed.amount),
  };
}
