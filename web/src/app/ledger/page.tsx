"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isDemoMode } from "@/lib/api";
import { money, monthLabelFromKey, shortDate } from "@/lib/format";
import { parseLedgerLink } from "@/lib/links";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useLedger } from "@/hooks/useLedger";
import LedgerList from "@/components/ledger/LedgerList";
import LedgerToolbar from "@/components/ledger/LedgerToolbar";
import Pagination from "@/components/ledger/Pagination";
import PeriodNav from "@/components/ledger/PeriodNav";
import ShortcutsHelp from "@/components/ledger/ShortcutsHelp";
import TransactionDrawer from "@/components/ledger/TransactionDrawer";
import QuickAddBar from "@/components/ledger/QuickAddBar";
import Button from "@/components/ui/Button";
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

  const reviewCount = useMemo(() => ledger.transactions.filter((t) => t.needs_review).length, [ledger.transactions]);

  useEffect(() => {
    if (params.get("add")) focusInput("quick-add");
  }, [params]);

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
      Escape: () => setHelp(false),
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
        <p className="muted small" style={{ fontFamily: "var(--mono)" }}>
          {ledger.error}
        </p>
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
        onAdd={({ amount, merchant, date, note, tags }) =>
          ledger.add({ accountId: ledger.filters.accountId || accounts[0]?.id, amount, merchant, date, note, tags })
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

      <LedgerList
        days={ledger.days}
        categories={categories}
        view={ledger.filters.view}
        hasAny={ledger.transactions.length > 0}
        loading={ledger.loading}
        total={ledger.totals.count}
        out={ledger.totals.out}
        income={ledger.totals.income}
        onRecategorise={ledger.recategorise}
        onOpen={setOpenId}
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
        />
      )}

      {isDemoMode() && (
        <p className={s.note}>
          Demo build — everything lives in this browser. Set <code>NEXT_PUBLIC_API_URL</code> to use the real backend.
        </p>
      )}
    </main>
  );
}
