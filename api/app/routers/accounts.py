from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Account, Transaction
from ..schemas import AccountIn, AccountOut

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _balance(db: Session, account: Account) -> int:
    rows = db.execute(
        select(Transaction.direction, func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == account.id)
        .group_by(Transaction.direction)
    ).all()
    delta = sum(amt if d == "credit" else -amt for d, amt in rows)
    return account.opening_balance + delta


@router.get("", response_model=list[AccountOut])
def list_accounts(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    rows = db.scalars(select(Account).where(Account.household_id == hid, Account.archived.is_(False))).all()
    return [AccountOut(id=a.id, name=a.name, type=a.type, institution=a.institution,
                       masked_number=a.masked_number, opening_balance=a.opening_balance,
                       balance=_balance(db, a)) for a in rows]


@router.post("", response_model=AccountOut, status_code=201)
def create_account(body: AccountIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    a = Account(household_id=hid, **body.model_dump())
    db.add(a)
    db.commit()
    return AccountOut(id=a.id, balance=a.opening_balance, **body.model_dump())


@router.delete("/{account_id}", status_code=204)
def archive_account(account_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    a = db.get(Account, account_id)
    if not a or a.household_id != hid:
        raise HTTPException(status_code=404, detail="Account not found")
    a.archived = True
    db.commit()
