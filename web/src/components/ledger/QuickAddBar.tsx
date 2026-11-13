"use client";

import Button from "@/components/ui/Button";
import { useQuickAdd, type QuickAddInput } from "@/hooks/useQuickAdd";
import { money, shortDate } from "@/lib/format";
import s from "./ledger.module.scss";

type Props = {
  onAdd: (input: QuickAddInput) => Promise<void>;
};

export default function QuickAddBar({ onAdd }: Props) {
  const { draft, setDraft, parsed, submit, submitting, ready } = useQuickAdd(onAdd);

  return (
    <>
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
          placeholder="Add a transaction — try “450 petrol, full tank before the trip #car”"
          aria-label="Quick add a transaction"
          aria-describedby="quick-add-preview"
        />
        <kbd className={s.kbd}>N</kbd>
        <Button type="submit" size="sm" disabled={!ready || submitting}>
          {submitting ? "Adding…" : "Add"}
        </Button>
      </form>
      {draft.trim() && (
        <p id="quick-add-preview" className={s.quickPreview} aria-live="polite">
          {parsed.amount ? <b className="num">{money(parsed.amount)}</b> : <span className={s.quickMissing}>no amount yet</span>}
          <span>{parsed.merchant}</span>
          <span>{shortDate(parsed.date)}</span>
          {parsed.note && <span className={s.quickNote}>“{parsed.note}”</span>}
          {parsed.tags.map((t) => (
            <span key={t} className={s.quickTag}>
              #{t}
            </span>
          ))}
        </p>
      )}
    </>
  );
}
