"use client";

import Button from "@/components/ui/Button";
import type { Account } from "@/lib/api";
import type { LedgerFilters } from "@/hooks/useLedger";
import s from "./ledger.module.scss";

type Props = {
  accounts: Account[];
  filters: LedgerFilters;
  onFiltersChange: (next: LedgerFilters) => void;
  onSeed: () => void;
  seeding: boolean;
};

export default function LedgerToolbar({ accounts, filters, onFiltersChange, onSeed, seeding }: Props) {
  return (
    <div className={s.toolbar}>
      <div className={s.search}>
        <input
          placeholder="Search merchant or note"
          value={filters.query}
          onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
          aria-label="Search transactions"
        />
      </div>

      <select
        className={s.select}
        value={filters.accountId}
        onChange={(e) => onFiltersChange({ ...filters, accountId: e.target.value })}
        aria-label="Filter by account"
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <Button variant="ghost" size="sm" onClick={onSeed} disabled={seeding}>
        {seeding ? "Loading…" : "Load demo data"}
      </Button>
    </div>
  );
}
