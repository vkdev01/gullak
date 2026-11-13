from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..deps import current_household_id
from ..models import Account, Household, Transaction
from ..schemas import GroupRow, MoneySummaryOut, PeriodFlowOut
from ..services import flows, plan
from ..services.periods import period_bounds, period_label, previous_period
from .accounts import _balance

router = APIRouter(prefix="/money", tags=["money"])

ACCOUNT_LABELS = {
    "fd": "Fixed deposits", "rd": "Recurring deposits", "ppf": "PPF", "epf": "EPF", "nps": "NPS",
    "mutual_fund": "Mutual funds", "stocks": "Stocks", "gold": "Gold", "other_investment": "Other investments",
}


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole > 0 else None


def _grouped(db: Session, hid: str, flow: str, start: date, end: date, by_account_type: bool) -> list[GroupRow]:
    rows = db.scalars(
        select(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.account))
        .where(
            Transaction.household_id == hid,
            flows.condition(flow),
            Transaction.occurred_at >= start,
            Transaction.occurred_at <= end,
        )
    ).all()
    buckets: dict[str, GroupRow] = {}
    for row in rows:
        if by_account_type and row.account and flows.is_investment(row.account.type):
            key, label = row.account.type, ACCOUNT_LABELS.get(row.account.type, row.account.type)
        else:
            key = row.category_id or "uncategorised"
            label = row.category.name if row.category else "Uncategorised"
        bucket = buckets.setdefault(key, GroupRow(key=key, label=label, total=0, count=0))
        bucket.total += row.amount
        bucket.count += 1
    return sorted(buckets.values(), key=lambda g: -g.total)


@router.get("/summary", response_model=MoneySummaryOut)
def money_summary(
    periods: int = Query(6, ge=1, le=24),
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
):
    """Where money came from and went, period by period, plus what the household owns."""
    household = db.get(Household, hid)
    anchor = household.cycle_start_day if household else 1
    start, end = period_bounds(anchor, date.today())

    history: list[PeriodFlowOut] = []
    window = (start, end)
    for _ in range(periods):
        income = plan.flow_total(db, hid, "income", *window)
        spent = plan.flow_total(db, hid, "spend", *window)
        invested = plan.flow_total(db, hid, "invest", *window)
        withdrawn = plan.flow_total(db, hid, "withdraw", *window)
        history.append(
            PeriodFlowOut(
                period_start=window[0], period_end=window[1], label=period_label(*window),
                income=income, spent=spent, invested=invested, withdrawn=withdrawn,
                saved=income - spent, savings_rate=_pct(income - spent, income), invest_rate=_pct(invested, income),
            )
        )
        window = previous_period(anchor, window[0])

    liquid = investments = owed = 0
    for account in db.scalars(select(Account).where(Account.household_id == hid, Account.archived.is_(False))):
        balance = _balance(db, account)
        if flows.is_investment(account.type):
            investments += account.current_value if account.current_value is not None else balance
        elif balance < 0:
            owed += -balance
        else:
            liquid += balance

    return MoneySummaryOut(
        periods=history,
        income_by_source=_grouped(db, hid, "income", start, end, by_account_type=False),
        invested_by_type=_grouped(db, hid, "invest", start, end, by_account_type=True),
        net_worth=liquid + investments - owed,
        liquid=liquid,
        investments=investments,
        owed=owed,
    )
