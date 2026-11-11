"use client";

import { useMemo, useState } from "react";
import { parseQuickAdd } from "@/lib/parse";

/**
 * Draft state for the one-line capture bar. The parse is recomputed as you type
 * so the UI can show what will be saved before you press enter.
 */
export function useQuickAdd(onSubmit: (parsed: { amount: number; merchant: string; date: string }) => Promise<void>) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const parsed = useMemo(() => parseQuickAdd(draft), [draft]);

  async function submit() {
    if (!parsed.amount) return;
    setSubmitting(true);
    try {
      await onSubmit({ amount: parsed.amount, merchant: parsed.merchant, date: parsed.date });
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  return { draft, setDraft, parsed, submit, submitting, ready: Boolean(parsed.amount) };
}
