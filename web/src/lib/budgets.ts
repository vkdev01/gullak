/** Budget arithmetic shared by the demo store and the UI. Mirrors api/app/services/plan.py. */

import type { BudgetStatus, Category } from "./api/types";

const PACE_GRACE = 0.1;
const PACE_MARGIN = 0.1;

/** elapsed is a fraction 0..1. A fixed bill is paid in one go, so it has no pace. */
export function paceStatus(spent: number, allocated: number, elapsed: number, fixed = false): BudgetStatus["status"] {
  if (allocated <= 0) return spent > 0 ? "over" : "on_track";
  const used = spent / allocated;
  if (spent > allocated) return "over";
  if (fixed) return "on_track";
  if (used >= 0.9 || (elapsed >= PACE_GRACE && used > elapsed + PACE_MARGIN)) return "at_risk";
  return "on_track";
}

export function projectedSpend(spent: number, elapsed: number): number | null {
  return elapsed >= PACE_GRACE ? Math.round(spent / elapsed) : null;
}

/** A budget on a parent category covers its children; null means every category. */
export function categoryScope(categoryId: string | null, categories: Category[]): Set<string> | null {
  if (!categoryId) return null;
  return new Set([categoryId, ...categories.filter((c) => c.parent_id === categoryId).map((c) => c.id)]);
}

export function budgetScope(categoryId: string | null, categories: Category[]): BudgetStatus["scope"] {
  if (!categoryId) return "overall";
  return categories.find((c) => c.id === categoryId)?.parent_id ? "category" : "group";
}

/** Money budgets still hold back, counting nested budgets once. */
export function reservedByBudgets(budgets: BudgetStatus[]): number {
  const overall = budgets.filter((b) => b.scope === "overall");
  if (overall.length) return overall.reduce((sum, b) => sum + Math.max(b.remaining, 0), 0);
  budgets = budgets.filter((b) => b.category_kind !== "income");
  const grouped = new Set(budgets.filter((b) => b.scope === "group").map((b) => b.category_id));
  return budgets
    .filter((b) => b.scope === "group" || !grouped.has(b.parent_id))
    .reduce((sum, b) => sum + Math.max(b.remaining, 0), 0);
}

export const STATUS_LABEL: Record<BudgetStatus["status"], string> = {
  on_track: "On pace",
  at_risk: "Ahead of pace",
  over: "Over",
};

export function statusLabel(b: BudgetStatus): string {
  if (!b.fixed || b.status === "over") return STATUS_LABEL[b.status];
  if (b.spent === 0) return "Due";
  return b.spent >= b.allocated ? "Paid" : "Part paid";
}
