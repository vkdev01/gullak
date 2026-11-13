"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, isDemoMode } from "@/lib/api";
import { money, monthLabelFromKey, shortDate } from "@/lib/format";
import { parseLedgerLink } from "@/lib/links";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useHotkeys } from "@/hooks/useHotkeys";
import { EMPTY_FILTERS, hasActiveFilters, useLedger } from "@/hooks/useLedger";
import LedgerList from "@/components/ledger/LedgerList";
import LedgerToolbar from "@/components/ledger/LedgerToolbar";
import Pagination from "@/components/ledger/Pagination";
import PeriodNav from "@/components/ledger/PeriodNav";
import ShortcutsHelp from "@/components/ledger/ShortcutsHelp";
import TransactionDrawer from "@/components/ledger/TransactionDrawer";
import QuickAddBar from "@/components/ledger/QuickAddBar";
import Button from "@/components/ui/Button";
import CategoryPicker from "@/components/ui/CategoryPicker";
import Toast, { type ToastState } from "@/components/ui/Toast";
import l from "@/components/ledger/ledger.module.scss";
import s from "./page.module.scss";

function focusRow(delta: number) {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-ledger-row]"));
  if (rows.length === 0) return;
  const at = rows.indexOf(document.activeElement as HTMLElement);
  const next = at < 0 ? (delta > 0 ? 0 : rows.length - 1) : Math.min(Math.max(at + delta, 0), rows.length - 1);
  rows[next].focus();
  rows[next].scrollIntoView({ block: "nearest" });
}

const focusInput = (id: string) => document.getElementById(id)?.focus();

// useSearchParams needs a Suspense boundary for the static export.
export default function LedgerRoute() {
  return (
    <Suspense fallback={null}>
      <LedgerPage />
    </Suspense>
  );
}

function LedgerPage() {
  const params = useSearchParams();
  const linkKey = params.toString();
  const link = useMemo(() => parseLedgerLink(new URLSearchParams(linkKey)), [linkKey]);

  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const ledger = useLedger(link, linkKey);
  const [seeding, setSeeding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const reviewCount = useMemo(() => ledger.transactions.filter((t) => t.needs_review).length, [ledger.transactions]);
  const closeToast = useCallback(() => setToast(null), []);
  const notify = useCallback(
    (message: string, actions?: NonNullable<ToastState>["actions"], tone?: "ok" | "error") =>
      setToast({ id: Date.now(), message, actions, tone }),
    [],
  );

  // rows that scrolled out of the window (another month, a filter) are no longer selected
  useEffect(() => {
    setSelected((prev) => {
      const here = new Set(ledger.transactions.map((t) => t.id));
      const kept = new Set([...prev].filter((id) => here.has(id)));
      return kept.size === prev.size ? prev : kept;
    });
  }, [ledger.transactions]);

  useEffect(() => {
    if (params.get("add")) focusInput("quick-add");
  }, [params]);

  const endSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setConfirmBulk(false);
    setBulkCategory("");
  };

  const toggleSelect = (id: string) => {
    setSelecting(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Delete on a focused row selects it and asks, rather than deleting on a stray key press.
  const askToDelete = (id: string) => {
    setSelecting(true);
    setSelected(new Set([id]));
    setConfirmBulk(true);
  };

  async function deleteSelected() {
    setBulkBusy(true);
    try {
      const deleted = await ledger.remove([...selected]);
      notify(`Deleted ${deleted} ${deleted === 1 ? "entry" : "entries"}`);
      endSelecting();
    } catch (e) {
      notify((e as Error).message, undefined, "error");
      setConfirmBulk(false);
    } finally {
      setBulkBusy(false);
    }
  }

  async function categoriseSelected() {
    setBulkBusy(true);
    try {
      const { updated } = await api.bulkCategorise([...selected], bulkCategory);
      await ledger.reload();
      notify(`Filed ${updated} ${updated === 1 ? "entry" : "entries"}`);
      endSelecting();
    } catch (e) {
      notify((e as Error).message, undefined, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleAdd(input: Parameters<typeof ledger.add>[0]) {
    const row = await ledger.add(input); // a failure surfaces under the input box
    ledger.reveal(row.occurred_at);
    const filed = row.category_name ? `\u2192 ${row.category_name}` : "· uncategorised";
    const hidden =
      hasActiveFilters(ledger.filters) ||
      Boolean(ledger.filters.accountId && ledger.filters.accountId !== row.account_id);
    notify(`Added ${row.direction === "credit" ? "+" : "−"}${money(row.amount)} · ${row.merchant} ${filed}`, [
      {
        label: "Undo",
        run: async () => {
          await api.deleteTransaction(row.id);
          await ledger.reload();
          notify("Removed it");
        },
      },
      { label: "Edit", run: () => setOpenId(row.id) },
      ...(hidden
        ? [{ label: "Show it", run: () => ledger.setFilters({ ...EMPTY_FILTERS }) }]
        : []),
    ]);
  }

  useHotkeys(
    {
      j: () => focusRow(1),
      k: () => focusRow(-1),
      ArrowDown: () => focusRow(1),
      ArrowUp: () => focusRow(-1),
      "/": () => focusInput("ledger-search"),
      n: () => focusInput("quick-add"),
      "[": () => ledger.stepMonth(-1),
      "]": () => !ledger.isCurrentMonth && ledger.stepMonth(1),
      "?": () => setHelp((v) => !v),
      Escape: () => {
        setHelp(false);
        if (selecting) endSelecting();
      },
    },
    !openId,
  );

  async function seed() {
    setSeeding(true);
    try {
      await ledger.seed();
    } finally {
      setSeeding(false);
    }
  }

  if (ledger.error) {
    return (
      <main className={s.page}>
        <h1 className={s.title}>Ledger</h1>
        <p className="muted small">Could not load the ledger: {ledger.error}</p>
        <Button size="sm" onClick={() => void ledger.reload()}>
          Try again
        </Button>
      </main>
    );
  }

  const periodLabel = ledger.range
    ? ledger.range.start === ledger.range.end
      ? shortDate(ledger.range.start)
      : `${shortDate(ledger.range.start)} – ${shortDate(ledger.range.end)}`
    : ledger.allTime
      ? "All time"
      : monthLabelFromKey(ledger.month);

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Ledger</h1>
          <p className={s.sub}>
            {periodLabel} · {ledger.totals.count} {ledger.totals.count === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className={s.actions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (selecting ? endSelecting() : setSelecting(true))}
            aria-pressed={selecting}
          >
            {selecting ? "Done selecting" : "Select"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setHelp((v) => !v)} aria-expanded={help}>
            Shortcuts <kbd>?</kbd>
          </Button>
          <Link href="/import/">
            <Button variant="ghost" size="sm">
              Import a statement
            </Button>
          </Link>
        </div>
      </header>

      {help && <ShortcutsHelp onClose={() => setHelp(false)} />}

      <section className={s.period}>
        <div className={s.periodMain}>
          <span className={s.periodLabel}>Spent · {periodLabel}</span>
          <span className={s.periodValue}>{money(ledger.totals.out)}</span>
        </div>
        <div className={s.periodSide}>
          <div>
            <span className={s.periodLabel}>In</span>
            <span className={s.periodSmall}>{money(ledger.totals.income)}</span>
          </div>
          <div>
            <span className={s.periodLabel}>Net</span>
            <span className={`${s.periodSmall} ${ledger.totals.net < 0 ? s.neg : ""}`}>{money(ledger.totals.net)}</span>
          </div>
          <div>
            <span className={s.periodLabel}>Entries</span>
            <span className={s.periodSmall}>{ledger.totals.count}</span>
          </div>
        </div>
      </section>

      <QuickAddBar
        accounts={accounts}
        preferredAccountId={ledger.filters.accountId}
        onAdd={({ accountId, amount, direction, merchant, date, note, tags }) =>
          handleAdd({ accountId, amount, direction, merchant, date, note, tags })
        }
      />

      <LedgerToolbar
        accounts={accounts}
        categories={categories}
        filters={ledger.filters}
        reviewCount={reviewCount}
        onFiltersChange={ledger.setFilters}
        onSeed={seed}
        seeding={seeding}
      />

      <PeriodNav
        month={ledger.month}
        allTime={ledger.allTime}
        range={ledger.range}
        isCurrentMonth={ledger.isCurrentMonth}
        onStep={ledger.stepMonth}
        onThisMonth={ledger.goToThisMonth}
        onToggleAllTime={ledger.showAllTime}
        onClearRange={ledger.clearRange}
      />

      {selecting && (
        <div className={l.bulkBar} role="region" aria-label="Bulk actions">
          <b>{selected.size} selected</b>
          <button
            type="button"
            className={l.bulkLink}
            onClick={() => setSelected(new Set(ledger.transactions.map((t) => t.id)))}
          >
            Select all {ledger.transactions.length} on this page
          </button>
          <span className={l.grow} />
          {confirmBulk ? (
            <>
              <span>
                Delete {selected.size} {selected.size === 1 ? "entry" : "entries"}? Balances change back; this cannot be
                undone.
              </span>
              <Button size="sm" onClick={() => void deleteSelected()} disabled={bulkBusy || selected.size === 0}>
                {bulkBusy ? "Deleting…" : "Yes, delete"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmBulk(false)}>
                Keep them
              </Button>
            </>
          ) : (
            <>
              <CategoryPicker
                categories={categories}
                value={bulkCategory}
                onChange={setBulkCategory}
                placeholder="File under…"
                aria-label="Category for the selected entries"
                size="sm"
                className={l.bulkPicker}
              />
              <Button size="sm" onClick={() => void categoriseSelected()} disabled={!bulkCategory || !selected.size || bulkBusy}>
                Apply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmBulk(true)} disabled={!selected.size}>
                Delete…
              </Button>
            </>
          )}
        </div>
      )}

      <LedgerList
        days={ledger.days}
        categories={categories}
        view={ledger.filters.view}
        hasAny={ledger.transactions.length > 0}
        loading={ledger.loading}
        total={ledger.totals.count}
        out={ledger.totals.out}
        income={ledger.totals.income}
        selecting={selecting}
        selected={selected}
        onRecategorise={ledger.recategorise}
        onOpen={setOpenId}
        onSelect={toggleSelect}
        onDeleteKey={askToDelete}
        onSeed={seed}
        seeding={seeding}
      />

      <Pagination
        page={ledger.page}
        pageCount={ledger.pageCount}
        pageSize={ledger.pageSize}
        total={ledger.totals.count}
        onPage={ledger.setPage}
      />

      {openId && (
        <TransactionDrawer
          id={openId}
          categories={categories}
          onClose={() => setOpenId(null)}
          onRecategorise={ledger.recategorise}
          onReviewed={() => void ledger.reload()}
          onChanged={() => void ledger.reload()}
          onDeleted={(deleted) => {
            void ledger.reload();
            notify(`Deleted ${deleted} ${deleted === 1 ? "entry" : "entries"}`);
          }}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />

      {isDemoMode() && (
        <p className={s.note}>
          Demo build — everything lives in this browser. Set <code>NEXT_PUBLIC_API_URL</code> to use the real backend.
        </p>
      )}
    </main>
  );
}
