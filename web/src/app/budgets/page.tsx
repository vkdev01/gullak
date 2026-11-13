"use client";

import { useState } from "react";
import BudgetCard from "@/components/budgets/BudgetCard";
import NewBudgetForm from "@/components/budgets/NewBudgetForm";
import Button from "@/components/ui/Button";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import type { BudgetStatus, Category } from "@/lib/api";
import { reservedByBudgets } from "@/lib/budgets";
import { money, ordinal, parseRupees, shortDate } from "@/lib/format";
import b from "@/components/budgets/budgets.module.scss";
import s from "./page.module.scss";

function subtitleFor(budget: BudgetStatus, categories: Category[]): string | undefined {
  if (budget.scope === "group") {
    const kids = categories.filter((c) => c.parent_id === budget.category_id).map((c) => c.name);
    return kids.length ? `All of it: ${kids.join(", ")}` : undefined;
  }
  return categories.find((c) => c.id === budget.parent_id)?.name;
}

export default function BudgetsPage() {
  const budgets = useBudgets();
  const { categories, reload: reloadCategories } = useCategories();
  const [overallInput, setOverallInput] = useState("");
  const [overallError, setOverallError] = useState<string | null>(null);

  const { overall, categoryBudgets, household } = budgets;
  const period = budgets.statuses[0] ?? null;
  const overallAverage = budgets.averageFor(null);
  const allocated = reservedByBudgets(categoryBudgets.map((x) => ({ ...x, remaining: x.allocated })));

  async function setOverall() {
    const paise = parseRupees(overallInput);
    if (!paise) return setOverallError("Enter an amount above zero");
    try {
      await budgets.create({ category_id: null, amount: paise });
      setOverallInput("");
      setOverallError(null);
    } catch (e) {
      setOverallError((e as Error).message);
    }
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1>Budgets</h1>
        <p>
          One overall number for everything you spend in a period, split into category budgets where you want a closer
          watch. The fill is money spent; the marker is today. Fill past the marker means you are spending faster than
          the period is passing.
        </p>
      </header>

      <section className={b.periodBar}>
        <span>
          {period
            ? `${shortDate(period.period_start)} – ${shortDate(period.period_end)} · ${period.days_left} days left`
            : "This period"}
        </span>
        {household && (
          <label>
            Periods start on the
            <select
              value={household.cycle_start_day}
              onChange={(e) => void budgets.setCycleDay(Number(e.target.value))}
              aria-label="Day each budget period starts"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {ordinal(day)}
                </option>
              ))}
            </select>
            <em>set it to your salary day</em>
          </label>
        )}
      </section>

      {budgets.error && <p className={s.error}>Could not load budgets: {budgets.error}</p>}

      {budgets.loading ? (
        <div className={b.skeleton} aria-busy="true" />
      ) : overall ? (
        <BudgetCard
          hero
          budget={overall}
          subtitle="Everything you spend, transfers excluded"
          average={overallAverage}
          onUpdate={(body) => budgets.update(overall.id, body)}
          onRemove={() => budgets.remove(overall.id)}
        />
      ) : (
        <section className={b.emptyOverall}>
          <div>
            <h2>Set an overall monthly budget</h2>
            <p>
              One number for all spending: rent, fuel, food, everything. Category budgets below then split it up, and the
              dashboard uses it to work out what is free to spend.
            </p>
            {overallAverage && (
              <p className={b.hint}>
                Your last {overallAverage.periods === 1 ? "period" : `${overallAverage.periods} periods`} averaged{" "}
                <b className="num">{money(overallAverage.average)}</b>.{" "}
                <button type="button" className={b.link} onClick={() => setOverallInput(String(Math.ceil(overallAverage.average / 100)))}>
                  Use it
                </button>
              </p>
            )}
          </div>
          <div className={b.formRow}>
            <label className={b.inline}>
              <span>Per period (₹)</span>
              <input value={overallInput} onChange={(e) => setOverallInput(e.target.value)} inputMode="decimal" placeholder="60,000" />
            </label>
            <Button onClick={() => void setOverall()} disabled={!overallInput}>
              Set budget
            </Button>
          </div>
          {overallError && <p className={b.error}>{overallError}</p>}
        </section>
      )}

      {overall && categoryBudgets.length > 0 && (
        <p className={allocated > overall.allocated ? b.allocWarn : b.alloc}>
          {allocated > overall.allocated
            ? `Category budgets add up to ${money(allocated)}, ${money(allocated - overall.allocated)} more than the overall budget.`
            : `Category budgets hold ${money(allocated)} of ${money(overall.allocated)}; the other ${money(overall.allocated - allocated)} covers everything without its own budget.`}
        </p>
      )}

      <section className={b.grid}>
        {categoryBudgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
            subtitle={subtitleFor(budget, categories)}
            average={budgets.averageFor(budget.category_id)}
            onUpdate={(body) => budgets.update(budget.id, body)}
            onRemove={() => budgets.remove(budget.id)}
          />
        ))}
      </section>

      <NewBudgetForm
        categories={categories}
        budgets={categoryBudgets}
        averageFor={budgets.averageFor}
        onCreate={(input) => budgets.create(input)}
        onCategoryCreated={() => reloadCategories()}
      />
    </main>
  );
}
