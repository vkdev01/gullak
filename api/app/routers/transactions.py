from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..deps import current_household_id
from ..models import Account, Category, Transaction
from ..schemas import BulkCategoriseIn, BulkCategoriseOut, ReviewRowOut, SummaryOut, TransactionIn, TransactionOut
from ..services import categorise as cat

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=t.id, account_id=t.account_id, amount=t.amount, direction=t.direction,
        occurred_at=t.occurred_at, merchant=t.merchant, category_id=t.category_id,
        note=t.note, source=t.source, confidence=t.confidence, needs_review=t.needs_review,
        account_name=t.account.name if t.account else None,
        category_name=t.category.name if t.category else None,
    )


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
    account_id: str | None = None,
    category_id: str | None = None,
    direction: str | None = None,
    q: str | None = None,
    start: date | None = None,
    end: date | None = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
):
    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.account), joinedload(Transaction.category))
        .where(Transaction.household_id == hid)  # tenant scope, always
    )
    if account_id:
        stmt = stmt.where(Transaction.account_id == account_id)
    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)
    if direction in ("debit", "credit"):
        stmt = stmt.where(Transaction.direction == direction)
    if q:
        stmt = stmt.where(Transaction.merchant.ilike(f"%{q}%"))
    if start:
        stmt = stmt.where(Transaction.occurred_at >= start)
    if end:
        stmt = stmt.where(Transaction.occurred_at <= end)
    stmt = stmt.order_by(Transaction.occurred_at.desc()).limit(limit).offset(offset)
    return [_out(t) for t in db.scalars(stmt).all()]


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(body: TransactionIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    account = db.get(Account, body.account_id)
    if not account or account.household_id != hid:
        raise HTTPException(status_code=404, detail="Account not found in this household")
    t = Transaction(household_id=hid, **body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return _out(t)


@router.patch("/{tx_id}", response_model=TransactionOut)
def update_transaction(tx_id: str, category_id: str | None = None, note: str | None = None,
                       hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    t = db.get(Transaction, tx_id)
    if not t or t.household_id != hid:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if category_id is not None:
        t.category_id = category_id
    if note is not None:
        t.note = note
    db.commit()
    db.refresh(t)
    return _out(t)


@router.get("/summary", response_model=SummaryOut)
def summary(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    month = date.today().replace(day=1)
    rows = db.execute(
        select(Transaction.direction, func.coalesce(func.sum(Transaction.amount), 0), func.count())
        .where(Transaction.household_id == hid, Transaction.occurred_at >= month)
        .group_by(Transaction.direction)
    ).all()
    spent = sum(amt for d, amt, _ in rows if d == "debit")
    income = sum(amt for d, amt, _ in rows if d == "credit")
    count = sum(c for _, _, c in rows)
    return SummaryOut(spent=spent, income=income, net=income - spent, count=count)


@router.get("/review", response_model=list[ReviewRowOut])
def review_queue(hid: str = Depends(current_household_id), db: Session = Depends(get_db), limit: int = Query(200, le=500)):
    """Everything the importer was not confident about, newest first."""
    rows = db.scalars(
        select(Transaction)
        .options(joinedload(Transaction.account), joinedload(Transaction.category))
        .where(Transaction.household_id == hid, Transaction.needs_review.is_(True))
        .order_by(Transaction.occurred_at.desc())
        .limit(limit)
    ).all()

    rules = cat.load_rules(db, hid)
    categories = cat.category_lookup(db, hid)
    out: list[ReviewRowOut] = []
    for t in rows:
        suggestion = cat.categorise(f"{t.merchant} {t.note}", rules, categories)
        base = _out(t)
        out.append(
            ReviewRowOut(
                **base.model_dump(),
                suggested_category_id=suggestion.category_id,
            )
        )
    return out


@router.post("/bulk", response_model=BulkCategoriseOut)
def bulk_categorise(body: BulkCategoriseIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """Assign one category to many rows at once — the review queue's main verb."""
    category = db.get(Category, body.category_id)
    if not category or category.household_id != hid:
        raise HTTPException(status_code=404, detail="Category not found in this household")

    rows = db.scalars(
        select(Transaction).where(Transaction.household_id == hid, Transaction.id.in_(body.ids))
    ).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No matching transactions")

    for t in rows:
        t.category_id = category.id
        t.confidence = 1.0
        t.needs_review = False
    db.commit()
    return BulkCategoriseOut(updated=len(rows))
