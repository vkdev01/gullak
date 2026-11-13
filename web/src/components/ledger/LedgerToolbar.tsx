"use client";

import Button from "@/components/ui/Button";
import { isDemoMode, type Account, type Category } from "@/lib/api";
import type { LedgerFilters, LedgerView } from "@/hooks/useLedger";
import s from "./ledger.module.scss";

type Props = {
  accounts: Account[];
  categories: Category[];
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
  categories,
  filters,
  reviewCount,
  onFiltersChange,
  onSeed,
  seeding,
}: Props) {
  const parents = categories.filter((c) => !c.parent_id);

  return (
    <div className={s.toolbar}>
      <div className={s.search}>
        <input
          id="ledger-search"
          placeholder="Search merchant or note"
          value={filters.query}
          onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
          aria-label="Search transactions"
        />
        <kbd className={s.kbd}>/</kbd>
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

      <select
        className={s.select}
        value={filters.categoryId}
        onChange={(e) => onFiltersChange({ ...filters, categoryId: e.target.value })}
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {parents.map((p) => (
          <optgroup key={p.id} label={p.name}>
            {categories
              .filter((c) => c.parent_id === p.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>

      {filters.direction && (
        <button
          type="button"
          className={s.filterChip}
          onClick={() => onFiltersChange({ ...filters, direction: "" })}
          aria-label="Show money in and out"
        >
          {filters.direction === "debit" ? "Money out only" : "Money in only"} ×
        </button>
      )}

      {filters.tag && (
        <button
          type="button"
          className={s.filterChip}
          onClick={() => onFiltersChange({ ...filters, tag: "" })}
          aria-label={`Stop filtering by #${filters.tag}`}
        >
          #{filters.tag} ×
        </button>
      )}

      {filters.excludeTransfers && (
        <button
          type="button"
          className={s.filterChip}
          onClick={() => onFiltersChange({ ...filters, excludeTransfers: false })}
          aria-label="Show transfers"
        >
          Transfers hidden ×
        </button>
      )}

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
