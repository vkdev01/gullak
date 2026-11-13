"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useQuickAdd, type QuickAddInput } from "@/hooks/useQuickAdd";
import type { Account } from "@/lib/api";
import { ACCOUNT_TYPE_LABEL } from "@/lib/flows";
import { money, shortDate } from "@/lib/format";
import s from "./ledger.module.scss";

type Props = {
  accounts: Account[];
  preferredAccountId?: string;
  onAdd: (input: QuickAddInput & { accountId: string }) => Promise<void>;
};

export default function QuickAddBar({ accounts, preferredAccountId, onAdd }: Props) {
  const spending = accounts.filter((a) => a.kind !== "investment");
  const [chosen, setChosen] = useState("");
  const accountId = chosen || preferredAccountId || spending[0]?.id || accounts[0]?.id || "";
  const { draft, setDraft, parsed, submit, submitting, ready, error } = useQuickAdd((input) =>
    onAdd({ ...input, accountId }),
  );

  if (accounts.length === 0) {
    return (
      <p className={s.quickBlocked}>
        Add an account before recording money in or out — every row belongs to one.{" "}
        <Link href="/accounts/">Add your bank account →</Link>
      </p>
    );
  }

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
          placeholder="450 petrol, full tank #car — or +85000 salary for money in"
          aria-label="Quick add a transaction"
          aria-describedby="quick-add-preview"
        />
        <kbd className={s.kbd}>N</kbd>
        <Select
          variant="bare"
          className={s.quickAccount}
          value={accountId}
          onChange={setChosen}
          aria-label="Account for the new row"
          options={accounts.map((a) => ({
            value: a.id,
            label: a.name,
            hint: a.kind === "investment" ? ACCOUNT_TYPE_LABEL[a.type] ?? a.type : undefined,
          }))}
        />
        <Button type="submit" size="sm" disabled={!ready || submitting || !accountId}>
          {submitting ? "Adding…" : "Add"}
        </Button>
      </form>
      {error ? (
        <p className={s.quickError} role="alert">
          Could not add it: {error}
        </p>
      ) : (
        draft.trim() && (
          <p id="quick-add-preview" className={s.quickPreview} aria-live="polite">
            {parsed.amount ? (
              <b className="num">
                {parsed.direction === "credit" ? "+" : "−"}
                {money(parsed.amount)}
              </b>
            ) : (
              <span className={s.quickMissing}>no amount yet</span>
            )}
            <span>{parsed.direction === "credit" ? "money in" : "money out"}</span>
            {parsed.hasName ? (
              <span>{parsed.merchant}</span>
            ) : (
              <span className={s.quickMissing}>
                add a name, e.g. {parsed.amount ? `${parsed.amount / 100} rent` : "450 petrol"}
              </span>
            )}
            <span>{shortDate(parsed.date)}</span>
            {parsed.note && <span className={s.quickNote}>“{parsed.note}”</span>}
            {parsed.tags.map((t) => (
              <span key={t} className={s.quickTag}>
                #{t}
              </span>
            ))}
          </p>
        )
      )}
    </>
  );
}
