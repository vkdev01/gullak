"use client";

import Link from "next/link";
import { useDashboard } from "@/hooks/useDashboard";
import { isDemoMode, resetDemoData } from "@/lib/api";
import BudgetStrip from "@/components/dashboard/BudgetStrip";
import DueSoon from "@/components/dashboard/DueSoon";
import GoalsRail from "@/components/dashboard/GoalsRail";
import HeroCard from "@/components/dashboard/HeroCard";
import InsightList from "@/components/dashboard/InsightList";
import SpendChart from "@/components/dashboard/SpendChart";
import Button from "@/components/ui/Button";
import s from "./page.module.scss";

export default function DashboardPage() {
  const { dashboard, loading, error, reload } = useDashboard();

  if (error) {
    return (
      <main className={s.page}>
        <h1 className={s.title}>Something went wrong loading this page</h1>
        <p className="muted small" style={{ fontFamily: "var(--mono)" }}>
          {error}
        </p>
        <p className="small muted" style={{ marginTop: 12 }}>
          {isDemoMode()
            ? "This is the static demo, so the data lives in your browser. If the store was written by an older build, resetting it fixes this."
            : "The web app could not reach the API. Start the FastAPI service in api/ and check NEXT_PUBLIC_API_URL."}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Button size="sm" onClick={() => void reload()}>
            Try again
          </Button>
          {isDemoMode() && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await resetDemoData();
                window.location.reload();
              }}
            >
              Reset demo data
            </Button>
          )}
        </div>
      </main>
    );
  }

  if (loading || !dashboard) {
    return (
      <main className={s.page}>
        <p className="small muted">Loading your period…</p>
      </main>
    );
  }

  const isEmpty = dashboard.spent === 0 && dashboard.income === 0;

  return (
    <main className={s.page}>
      <div className={s.topline}>
        <div>
          <h1 className={s.title}>Dashboard</h1>
          <p className={s.sub}>
            {dashboard.period_label} · {dashboard.days_left} days left
          </p>
        </div>
        <div className={s.actions}>
          <Link href="/import/">
            <Button variant="ghost" size="sm">
              Import a statement
            </Button>
          </Link>
          <Link href="/ledger/">
            <Button size="sm">Open the ledger</Button>
          </Link>
        </div>
      </div>

      {isEmpty && (
        <p className={s.banner}>
          This period is empty. Import a statement or load demo data on the ledger to see the dashboard with real
          numbers.
        </p>
      )}

      <div className={s.grid}>
        <div className={s.span12}>
          <HeroCard data={dashboard} />
        </div>

        <div className={s.span8}>
          <SpendChart data={dashboard} />
        </div>
        <div className={`${s.span4} ${s.stack}`}>
          <GoalsRail data={dashboard} />
          <DueSoon data={dashboard} />
        </div>

        <div className={s.span12}>
          <BudgetStrip data={dashboard} />
        </div>

        <div className={s.span12}>
          <InsightList data={dashboard} />
        </div>
      </div>

      {isDemoMode() && (
        <p className={s.note}>
          Demo build — everything lives in this browser.{" "}
          <button
            type="button"
            className={s.reset}
            onClick={async () => {
              await resetDemoData();
              window.location.reload();
            }}
          >
            Reset demo data
          </button>{" "}
          · run the FastAPI service and set <code>NEXT_PUBLIC_API_URL</code> to use the real backend.
        </p>
      )}
    </main>
  );
}
