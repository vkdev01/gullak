from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Budget, Category, Household
from ..schemas import BudgetIn, BudgetOut, BudgetPatch, BudgetStatusOut
from ..services import plan

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _out(budget: Budget, category_name: str | None) -> BudgetOut:
    return BudgetOut(
        id=budget.id,
        name=budget.name or category_name or "Envelope",
        category_id=budget.category_id,
        period=budget.period,
        amount=budget.amount,
        rollover=budget.rollover,
        is_active=budget.is_active,
    )


def _anchor(db: Session, household_id: str) -> int:
    household = db.get(Household, household_id)
    return household.cycle_start_day if household else 1


@router.get("", response_model=list[BudgetOut])
def list_budgets(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    names = {c.id: c.name for c in db.scalars(select(Category).where(Category.household_id == hid))}
    budgets = db.scalars(select(Budget).where(Budget.household_id == hid).order_by(Budget.created_at))
    return [_out(b, names.get(b.category_id or "")) for b in budgets]


@router.post("", response_model=BudgetOut, status_code=201)
def create_budget(body: BudgetIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    if body.category_id:
        category = db.get(Category, body.category_id)
        if not category or category.household_id != hid:
            raise HTTPException(status_code=404, detail="Category not found in this household")

    budget = Budget(
        household_id=hid,
        name=body.name,
        category_id=body.category_id,
        period=body.period,
        amount=body.amount,
        rollover=body.rollover,
        created_on=date.today(),
    )
    db.add(budget)
    db.commit()

    name = db.get(Category, body.category_id).name if body.category_id else None
    return _out(budget, name)


@router.patch("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: str,
    body: BudgetPatch,
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
):
    budget = db.get(Budget, budget_id)
    if not budget or budget.household_id != hid:
        raise HTTPException(status_code=404, detail="Budget not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    db.commit()

    name = db.get(Category, budget.category_id).name if budget.category_id else None
    return _out(budget, name)


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if not budget or budget.household_id != hid:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()


@router.get("/status", response_model=list[BudgetStatusOut])
def budget_status(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """Used, remaining and pace for the current period — the numbers the dashboard shows."""
    anchor = _anchor(db, hid)
    return [
        BudgetStatusOut(**vars(status))
        for status in plan.budget_statuses(db, hid, anchor, date.today())
    ]
