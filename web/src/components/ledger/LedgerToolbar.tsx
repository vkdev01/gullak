"use client";

import Button from "@/components/ui/Button";
import CategoryPicker from "@/components/ui/CategoryPicker";
import Select from "@/components/ui/Select";
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

const FLOW_LABEL = { spend: "Spending only", income: "Income only", invest: "Saved & invested", withdraw: "Withdrawals" };

export default function LedgerToolbar({
  accounts,
  categories,
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
          id="ledger-search"
          placeholder="Search merchant or note"
          value={filters.query}
          onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
          aria-label="Search transactions"
        />
        <kbd className={s.kbd}>/</kbd>
      </div>

      <Select
        size="sm"
        className={s.filterSelect}
        value={filters.accountId}
        onChange={(accountId) => onFiltersChange({ ...filters, accountId })}
        aria-label="Filter by account"
        options={[{ value: "", label: "All accounts" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
      />

      <CategoryPicker
        size="sm"
        className={s.filterSelect}
        categories={categories}
        value={filters.categoryId}
        emptyLabel="All categories"
        placeholder="All categories"
        aria-label="Filter by category"
        onChange={(categoryId) => onFiltersChange({ ...filters, categoryId })}
      />

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

      {filters.flow && (
        <button
          type="button"
          className={s.filterChip}
          onClick={() => onFiltersChange({ ...filters, flow: "" })}
          aria-label="Show every kind of row"
        >
          {FLOW_LABEL[filters.flow]} ×
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
