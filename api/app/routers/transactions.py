import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..deps import current_household_id
from ..models import Account, Category, ImportBatch, Transaction
from ..schemas import (
    BulkCategoriseIn,
    CountOut,
    BulkCategoriseOut,
    GroupRow,
    ReviewRowOut,
    SummaryOut,
    TransactionIn,
    TransactionDetailOut,
    TransactionOut,
    TransferIn,
    TransferOut,
)
from ..services import categorise as cat

router = APIRouter(prefix="/transactions", tags=["transactions"])
transfers = APIRouter(prefix="/transfers", tags=["transfers"])


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
    needs_review: bool | None = None,
    uncategorised: bool | None = None,
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
    if needs_review:
        stmt = stmt.where(Transaction.needs_review.is_(True))
    if uncategorised:
        stmt = stmt.where(Transaction.category_id.is_(None))
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
        .where(
            Transaction.household_id == hid,
            Transaction.occurred_at >= month,
            Transaction.transfer_id.is_(None),
        )
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


@router.get("/group", response_model=list[GroupRow])
def group_transactions(
    by: str = Query("category", pattern="^(category|day|merchant)$"),
    start: date | None = None,
    end: date | None = None,
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
):
    """Spend grouped for charts. Transfers are excluded — moving money is not spending."""
    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(
            Transaction.household_id == hid,
            Transaction.direction == "debit",
            Transaction.transfer_id.is_(None),
        )
    )
    if start:
        stmt = stmt.where(Transaction.occurred_at >= start)
    if end:
        stmt = stmt.where(Transaction.occurred_at <= end)

    buckets: dict[str, dict] = {}
    for row in db.scalars(stmt).all():
        if by == "category":
            key = row.category_id or "uncategorised"
            label = row.category.name if row.category else "Uncategorised"
        elif by == "merchant":
            key = row.merchant
            label = row.merchant
        else:
            key = row.occurred_at.isoformat()
            label = row.occurred_at.isoformat()

        bucket = buckets.setdefault(key, {"key": key, "label": label, "total": 0, "count": 0})
        bucket["total"] += row.amount
        bucket["count"] += 1

    rows = [GroupRow(**b) for b in buckets.values()]
    return sorted(rows, key=lambda r: r.key)


@transfers.post("", response_model=TransferOut, status_code=201)
def create_transfer(body: TransferIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """Two legs, one id. A card payment must never look like spending."""
    if body.from_account_id == body.to_account_id:
        raise HTTPException(status_code=422, detail="Pick two different accounts")

    source = db.get(Account, body.from_account_id)
    target = db.get(Account, body.to_account_id)
    for account in (source, target):
        if not account or account.household_id != hid:
            raise HTTPException(status_code=404, detail="Account not found in this household")

    transfer_id = uuid.uuid4().hex
    out_leg = Transaction(
        household_id=hid,
        account_id=source.id,
        direction="debit",
        amount=body.amount,
        occurred_at=body.occurred_at,
        merchant=f"Transfer to {target.name}",
        note=body.note,
        source="manual",
        confidence=1.0,
        transfer_id=transfer_id,
    )
    in_leg = Transaction(
        household_id=hid,
        account_id=target.id,
        direction="credit",
        amount=body.amount,
        occurred_at=body.occurred_at,
        merchant=f"Transfer from {source.name}",
        note=body.note,
        source="manual",
        confidence=1.0,
        transfer_id=transfer_id,
    )
    db.add_all([out_leg, in_leg])
    db.commit()
    return TransferOut(transfer_id=transfer_id, from_transaction_id=out_leg.id, to_transaction_id=in_leg.id)


@router.get("/count", response_model=CountOut)
def count_transactions(
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
    account_id: str | None = None,
    category_id: str | None = None,
    direction: str | None = None,
    needs_review: bool | None = None,
    uncategorised: bool | None = None,
    q: str | None = None,
    start: date | None = None,
    end: date | None = None,
):
    """How many rows match the same filters the list is using, and what they add up to."""
    stmt = select(Transaction).where(Transaction.household_id == hid)
    if account_id:
        stmt = stmt.where(Transaction.account_id == account_id)
    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)
    if direction in ("debit", "credit"):
        stmt = stmt.where(Transaction.direction == direction)
    if needs_review:
        stmt = stmt.where(Transaction.needs_review.is_(True))
    if uncategorised:
        stmt = stmt.where(Transaction.category_id.is_(None))
    if q:
        stmt = stmt.where(Transaction.merchant.ilike(f"%{q}%"))
    if start:
        stmt = stmt.where(Transaction.occurred_at >= start)
    if end:
        stmt = stmt.where(Transaction.occurred_at <= end)

    rows = db.scalars(stmt).all()
    out = sum(r.amount for r in rows if r.direction == "debit")
    income = sum(r.amount for r in rows if r.direction == "credit")
    return CountOut(count=len(rows), out=out, income=income, net=income - out)


@router.get("/{tx_id}", response_model=TransactionDetailOut)
def get_transaction(tx_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """One row in full, including where it came from — the drawer behind the ledger."""
    tx = db.get(Transaction, tx_id)
    if not tx or tx.household_id != hid:
        raise HTTPException(status_code=404, detail="Transaction not found")

    account = db.get(Account, tx.account_id)
    category = db.get(Category, tx.category_id) if tx.category_id else None
    parent = db.get(Category, category.parent_id) if category and category.parent_id else None
    batch = db.get(ImportBatch, tx.import_batch_id) if tx.import_batch_id else None

    return TransactionDetailOut(
        id=tx.id,
        account_id=tx.account_id,
        account_name=account.name if account else None,
        amount=tx.amount,
        direction=tx.direction,
        occurred_at=tx.occurred_at,
        merchant=tx.merchant,
        note=tx.note or "",
        category_id=tx.category_id,
        category_name=category.name if category else None,
        category_parent=parent.name if parent else None,
        source=tx.source,
        confidence=tx.confidence or 0.0,
        needs_review=bool(tx.needs_review),
        transfer_id=tx.transfer_id,
        dedupe_hash=tx.dedupe_hash,
        created_at=tx.created_at.isoformat() if tx.created_at else None,
        import_filename=batch.filename if batch else None,
        import_batch_id=tx.import_batch_id,
    )
