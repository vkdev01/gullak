"use client";

import Button from "@/components/ui/Button";
import { useQuickAdd } from "@/hooks/useQuickAdd";
import s from "./ledger.module.scss";

type Props = {
  onAdd: (input: { amount: number; merchant: string; date: string }) => Promise<void>;
};

export default function QuickAddBar({ onAdd }: Props) {
  const { draft, setDraft, submit, submitting, ready } = useQuickAdd(onAdd);

  return (
    <form
      className={s.quick}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        id="quick-add"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add a transaction — try “320 swiggy yesterday”"
        aria-label="Quick add a transaction"
      />
      <kbd className={s.kbd}>N</kbd>
      <Button type="submit" size="sm" disabled={!ready || submitting}>
        {submitting ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
