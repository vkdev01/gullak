from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Account, Household, Transaction
from ..schemas import AccountIn, AccountOut, AccountPatch
from ..services import flows
from ..services.periods import period_bounds

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _balance(db: Session, account: Account) -> int:
    rows = db.execute(
        select(Transaction.direction, func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == account.id)
        .group_by(Transaction.direction)
    ).all()
    delta = sum(amt if d == "credit" else -amt for d, amt in rows)
    return account.opening_balance + delta


def _contributed(db: Session, account: Account, start: date, end: date) -> int:
    return int(db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.account_id == account.id,
            Transaction.direction == "credit",
            Transaction.occurred_at >= start,
            Transaction.occurred_at <= end,
        )
    ) or 0)


def _out(db: Session, a: Account, window: tuple[date, date]) -> AccountOut:
    balance = _balance(db, a)
    investment = flows.is_investment(a.type)
    value = a.current_value if investment and a.current_value is not None else balance
    return AccountOut(
        id=a.id, name=a.name, type=a.type, institution=a.institution, masked_number=a.masked_number,
        opening_balance=a.opening_balance, description=a.description or "", interest_rate=a.interest_rate,
        maturity_date=a.maturity_date, monthly_amount=a.monthly_amount, current_value=a.current_value,
        value_as_of=a.value_as_of, kind="investment" if investment else "spending",
        balance=balance, value=value,
        gain=value - balance if investment and a.current_value is not None else None,
        contributed_this_period=_contributed(db, a, *window) if investment else 0,
    )


def _window(db: Session, hid: str) -> tuple[date, date]:
    household = db.get(Household, hid)
    return period_bounds(household.cycle_start_day if household else 1, date.today())


def _owned(db: Session, hid: str, account_id: str) -> Account:
    a = db.get(Account, account_id)
    if not a or a.household_id != hid:
        raise HTTPException(status_code=404, detail="Account not found")
    return a


@router.get("", response_model=list[AccountOut])
def list_accounts(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    rows = db.scalars(select(Account).where(Account.household_id == hid, Account.archived.is_(False))).all()
    window = _window(db, hid)
    return [_out(db, a, window) for a in rows]


@router.post("", response_model=AccountOut, status_code=201)
def create_account(body: AccountIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    if body.type not in flows.ACCOUNT_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown account type; use one of {', '.join(flows.ACCOUNT_TYPES)}")
    a = Account(household_id=hid, **body.model_dump())
    if body.current_value is not None:
        a.value_as_of = date.today()
    db.add(a)
    db.commit()
    return _out(db, a, _window(db, hid))


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(account_id: str, body: AccountPatch, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """Describe an account, or record what an investment is worth today."""
    a = _owned(db, hid, account_id)
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(a, field, value)
    if "current_value" in changes:
        a.value_as_of = date.today() if changes["current_value"] is not None else None
    db.commit()
    return _out(db, a, _window(db, hid))


@router.delete("/{account_id}", status_code=204)
def archive_account(account_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    a = _owned(db, hid, account_id)
    a.archived = True
    db.commit()
