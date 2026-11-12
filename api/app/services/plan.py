"""Budgets, goals and the numbers on the dashboard.

Everything here is deterministic arithmetic over rows. No model, no guessing:
if a number appears on the dashboard it can be traced to the query that
produced it, which is the whole point of a finance app you can trust.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Budget, Category, Goal, GoalContribution, Transaction
from .periods import elapsed_fraction, period_bounds, period_label, previous_period


@dataclass
class BudgetStatus:
    id: str
    name: str
    category_id: str | None
    category_name: str | None
    period_start: date
    period_end: date
    allocated: int
    carried: int
    spent: int
    remaining: int
    used_pct: float
    elapsed_pct: float
    status: str  # on_track | at_risk | over
    rollover: bool


@dataclass
class GoalStatus:
    id: str
    name: str
    target: int
    contributed: int
    progress_pct: float
    monthly_target: int | None
    target_date: date | None
    projected_finish: date | None
    status: str


@dataclass
class Dashboard:
    period_start: date
    period_end: date
    period_label: str
    days_left: int
    elapsed_pct: float
    income: int
    spent: int
    committed: int
    budgeted_remaining: int
    free_to_spend: int
    budgets: list[BudgetStatus] = field(default_factory=list)
    goals: list[GoalStatus] = field(default_factory=list)
    due_soon: list[dict] = field(default_factory=list)
    sparkline: list[dict] = field(default_factory=list)
    insights: list[dict] = field(default_factory=list)


def spend_rows(db: Session, household_id: str, start: date, end: date) -> list[Transaction]:
    """Debits inside a window, transfers excluded — moving money is not spending."""
    return list(
        db.scalars(
            select(Transaction).where(
                Transaction.household_id == household_id,
                Transaction.direction == "debit",
                Transaction.transfer_id.is_(None),
                Transaction.occurred_at >= start,
                Transaction.occurred_at <= end,
            )
        )
    )


def _budget_spent(budget: Budget, rows: list[Transaction], start: date, end: date) -> int:
    total = 0
    for row in rows:
        if not (start <= row.occurred_at <= end):
            continue
        if budget.category_id and row.category_id != budget.category_id:
            continue
        total += row.amount
    return total


def _carried_in(budget: Budget, rows: list[Transaction], anchor: int, current_start: date) -> int:
    """Walk forward from the budget's first period, carrying what rollover allows."""
    if not budget.rollover:
        return 0
    start = period_bounds(anchor, budget.created_on)[0]
    carried = 0
    guard = 0
    while start < current_start and guard < 24:  # two years of history is plenty
        end = period_bounds(anchor, start)[1]
        carried = carried + budget.amount - _budget_spent(budget, rows, start, end)
        start = _next_start(anchor, start)
        guard += 1
    return carried


def _next_start(anchor: int, start: date) -> date:
    return period_bounds(anchor, start + timedelta(days=32))[0]


def budget_statuses(db: Session, household_id: str, anchor: int, today: date) -> list[BudgetStatus]:
    budgets = list(db.scalars(select(Budget).where(Budget.household_id == household_id, Budget.is_active.is_(True))))
    names = {c.id: c.name for c in db.scalars(select(Category).where(Category.household_id == household_id))}
    start, end = period_bounds(anchor, today)
    rows = spend_rows(db, household_id, min(start, budget_start_floor(db, household_id, anchor)), end)
    elapsed = elapsed_fraction(start, end, today)

    out: list[BudgetStatus] = []
    for budget in budgets:
        carried = _carried_in(budget, rows, anchor, start)
        allocated = budget.amount + carried
        spent = _budget_spent(budget, rows, start, end)
        remaining = allocated - spent
        used = (spent / allocated * 100) if allocated else 0.0
        if allocated and spent > allocated:
            status = "over"
        elif allocated and spent / allocated > max(elapsed + 0.15, 0.9):
            status = "at_risk"
        else:
            status = "on_track"

        out.append(
            BudgetStatus(
                id=budget.id,
                name=budget.name or names.get(budget.category_id or "", "Envelope"),
                category_id=budget.category_id,
                category_name=names.get(budget.category_id or ""),
                period_start=start,
                period_end=end,
                allocated=allocated,
                carried=carried,
                spent=spent,
                remaining=remaining,
                used_pct=round(used, 1),
                elapsed_pct=round(elapsed * 100, 1),
                status=status,
                rollover=budget.rollover,
            )
        )
    return out


def budget_start_floor(db: Session, household_id: str, anchor: int) -> date:
    """Start of the oldest budget's first period, so rollover maths has history to read."""
    budgets = list(db.scalars(select(Budget).where(Budget.household_id == household_id)))
    if not budgets:
        return date.today() - timedelta(days=60)
    return min(period_bounds(anchor, b.created_on)[0] for b in budgets)


def goal_statuses(db: Session, household_id: str, today: date) -> list[GoalStatus]:
    goals = list(db.scalars(select(Goal).where(Goal.household_id == household_id)))
    out: list[GoalStatus] = []
    for goal in goals:
        contributed = sum(
            c.amount for c in db.scalars(select(GoalContribution).where(GoalContribution.goal_id == goal.id))
        )
        remaining = max(goal.target - contributed, 0)
        monthly = goal.monthly_target
        projected = None
        if monthly and monthly > 0:
            months = -(-remaining // monthly)
            projected = date(today.year + (today.month - 1 + months) // 12, (today.month - 1 + months) % 12 + 1, 1)
        out.append(
            GoalStatus(
                id=goal.id,
                name=goal.name,
                target=goal.target,
                contributed=contributed,
                progress_pct=round(contributed / goal.target * 100, 1) if goal.target else 0.0,
                monthly_target=monthly,
                target_date=goal.target_date,
                projected_finish=projected,
                status="achieved" if contributed >= goal.target else goal.status,
            )
        )
    return out


def committed_for_period(db: Session, household_id: str, series, start: date, end: date) -> int:
    """Expected recurring outflows that fall inside the period."""
    total = 0
    for item in series:
        due = item["next_due"]
        if start <= due <= end:
            total += item["expected_amount"]
    return total


def sparkline(rows: list[Transaction], start: date, end: date) -> list[dict]:
    by_day: dict[date, int] = {}
    for row in rows:
        by_day[row.occurred_at] = by_day.get(row.occurred_at, 0) + row.amount
    out = []
    day = start
    while day <= end:
        out.append({"date": day.isoformat(), "amount": by_day.get(day, 0)})
        day += timedelta(days=1)
    return out


def month_insights(rows: list[Transaction], prev_rows: list[Transaction], categories: dict[str, str]) -> list[dict]:
    """Category drift against a trailing median. Deterministic, with a fact pack."""
    current: dict[str, int] = {}
    for row in rows:
        key = row.category_id or "uncategorised"
        current[key] = current.get(key, 0) + row.amount

    previous: dict[str, int] = {}
    for row in prev_rows:
        key = row.category_id or "uncategorised"
        previous[key] = previous.get(key, 0) + row.amount

    deltas = []
    for key, amount in current.items():
        baseline = previous.get(key, 0)
        if baseline == 0:
            continue
        deltas.append((key, amount - baseline, amount, baseline))

    deltas.sort(key=lambda row: abs(row[1]), reverse=True)
    out = []
    for key, delta, amount, baseline in deltas[:3]:
        if abs(delta) < 50_000:  # ignore under ₹500 of noise
            continue
        out.append(
            {
                "kind": "month_delta",
                "severity": "warn" if delta > 0 else "info",
                "title": f"{categories.get(key, 'Uncategorised')} is {'up' if delta > 0 else 'down'} {abs(delta)}",
                "fact_pack": {
                    "query": "sum(transactions.amount) group by category_id",
                    "category_id": key,
                    "category_name": categories.get(key, "Uncategorised"),
                    "current": amount,
                    "previous": baseline,
                    "delta": delta,
                },
            }
        )
    return out


def anomaly_insights(rows: list[Transaction], history: list[Transaction]) -> list[dict]:
    """A transaction far above its own merchant's baseline."""
    by_merchant: dict[str, list[int]] = {}
    for row in history:
        by_merchant.setdefault(row.merchant, []).append(row.amount)

    out = []
    for row in rows:
        amounts = by_merchant.get(row.merchant, [])
        if len(amounts) < 4:
            continue
        mean = statistics.fmean(amounts)
        stdev = statistics.pstdev(amounts) or 1
        if row.amount > mean + 2 * stdev and row.amount > 100_000:
            out.append(
                {
                    "kind": "anomaly",
                    "severity": "warn",
                    "title": f"{row.merchant} is unusually high",
                    "fact_pack": {
                        "query": "merchant baseline, 2 sigma",
                        "transaction_id": row.id,
                        "merchant": row.merchant,
                        "amount": row.amount,
                        "mean": round(mean),
                        "stdev": round(stdev),
                    },
                }
            )
    return out[:3]


def build_dashboard(db: Session, household_id: str, anchor: int, today: date, series: list[dict], categories: dict[str, str]) -> Dashboard:
    start, end = period_bounds(anchor, today)
    prev_start, prev_end = previous_period(anchor, start)

    rows = spend_rows(db, household_id, start, end)
    prev_rows = spend_rows(db, household_id, prev_start, prev_end)

    income = sum(
        t.amount
        for t in db.scalars(
            select(Transaction).where(
                Transaction.household_id == household_id,
                Transaction.direction == "credit",
                Transaction.transfer_id.is_(None),
                Transaction.occurred_at >= start,
                Transaction.occurred_at <= end,
            )
        )
    )
    spent = sum(r.amount for r in rows)
    budgets = budget_statuses(db, household_id, anchor, today)
    budgeted_remaining = sum(max(b.remaining, 0) for b in budgets)
    committed = committed_for_period(db, household_id, series, start, end)

    # If income has not landed yet, plan against last period's income rather than zero.
    expected_income = income
    if income == 0:
        expected_income = sum(
            t.amount
            for t in db.scalars(
                select(Transaction).where(
                    Transaction.household_id == household_id,
                    Transaction.direction == "credit",
                    Transaction.transfer_id.is_(None),
                    Transaction.occurred_at >= prev_start,
                    Transaction.occurred_at <= prev_end,
                )
            )
        )

    free = expected_income - committed - budgeted_remaining
    due_soon = [s for s in series if start <= s["next_due"] <= end][:5]

    return Dashboard(
        period_start=start,
        period_end=end,
        period_label=period_label(start, end),
        days_left=max((end - today).days + 1, 0),
        elapsed_pct=round(elapsed_fraction(start, end, today) * 100, 1),
        income=income,
        spent=spent,
        committed=committed,
        budgeted_remaining=budgeted_remaining,
        free_to_spend=free,
        budgets=budgets,
        goals=goal_statuses(db, household_id, today),
        due_soon=[
            {"merchant": s["merchant"], "amount": s["expected_amount"], "due": s["next_due"].isoformat(), "cadence": s["cadence"]}
            for s in due_soon
        ],
        sparkline=sparkline(rows, start, end),
        insights=month_insights(rows, prev_rows, categories) + anomaly_insights(rows, rows + prev_rows),
    )
