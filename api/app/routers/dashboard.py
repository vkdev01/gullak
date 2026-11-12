from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Category, Household
from ..schemas import BudgetStatusOut, DashboardOut, GoalOut, SeriesOut
from ..services import plan, recurring

router = APIRouter(tags=["dashboard"])


def _anchor(db: Session, household_id: str) -> int:
    household = db.get(Household, household_id)
    return household.cycle_start_day if household else 1


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """One round trip for the home screen. Every number here is arithmetic over rows."""
    anchor = _anchor(db, hid)
    series = recurring.detect_series(db, hid)
    categories = {c.id: c.name for c in db.scalars(select(Category).where(Category.household_id == hid))}
    result = plan.build_dashboard(db, hid, anchor, date.today(), series, categories)
    return DashboardOut(
        period_start=result.period_start,
        period_end=result.period_end,
        period_label=result.period_label,
        days_left=result.days_left,
        elapsed_pct=result.elapsed_pct,
        income=result.income,
        spent=result.spent,
        committed=result.committed,
        budgeted_remaining=result.budgeted_remaining,
        free_to_spend=result.free_to_spend,
        budgets=[BudgetStatusOut(**vars(b)) for b in result.budgets],
        goals=[GoalOut(**vars(g)) for g in result.goals],
        due_soon=result.due_soon,
        sparkline=result.sparkline,
        insights=result.insights,
    )


@router.get("/recurring", response_model=list[SeriesOut])
def recurring_series(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    return [SeriesOut(**item) for item in recurring.detect_series(db, hid)]
