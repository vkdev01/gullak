"use client";

import Button from "@/components/ui/Button";
import { isDemoMode, type Account } from "@/lib/api";
import type { LedgerFilters, LedgerView } from "@/hooks/useLedger";
import s from "./ledger.module.scss";

type Props = {
  accounts: Account[];
  filters: LedgerFilters;
  reviewCount: number;
  onFiltersChange: (next: LedgerFilters) => void;
  onSeed: () => void;
  seeding: boolean;
};

const VIEWS: { key: LedgerView; label: string }[] = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs review" },
  { key: "uncategorised", label: "Uncategorised" },
];

export default function LedgerToolbar({
  accounts,
  filters,
  reviewCount,
  onFiltersChange,
  onSeed,
  seeding,
}: Props) {
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

      <div className={s.segment} role="tablist" aria-label="Filter">
        {VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            role="tab"
            aria-selected={filters.view === view.key}
            className={filters.view === view.key ? s.segOn : undefined}
            onClick={() => onFiltersChange({ ...filters, view: view.key })}
          >
            {view.label}
            {view.key === "review" && reviewCount > 0 ? ` · ${reviewCount}` : ""}
          </button>
        ))}
      </div>

      {isDemoMode() && (
        <Button variant="ghost" size="sm" onClick={onSeed} disabled={seeding}>
          {seeding ? "Loading…" : "Load demo data"}
        </Button>
      )}
    </div>
  );
}
