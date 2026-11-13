import uuid
from datetime import date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..deps import current_household_id
from ..models import Account, Category, GoalContribution, ImportBatch, Transaction
from ..schemas import (
    BulkCategoriseIn,
    BulkDeleteIn,
    CountOut,
    BulkCategoriseOut,
    DeletedOut,
    GroupRow,
    ReviewRowOut,
    SummaryOut,
    TransactionIn,
    TransactionDetailOut,
    TransactionOut,
    TransactionPatch,
    TransferIn,
    TransferOut,
)
from ..services import categorise as cat
from ..services import flows
from ..services import tags as tagging

router = APIRouter(prefix="/transactions", tags=["transactions"])
transfers = APIRouter(prefix="/transfers", tags=["transfers"])


def _out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=t.id, account_id=t.account_id, amount=t.amount, direction=t.direction,
        occurred_at=t.occurred_at, merchant=t.merchant, category_id=t.category_id,
        note=t.note, tags=tagging.decode(t.tags), source=t.source, confidence=t.confidence,
        needs_review=t.needs_review,
        account_name=t.account.name if t.account else None,
        category_name=t.category.name if t.category else None,
    )


def _search(stmt, q: str | None, tag: str | None, flow: str | None = None):
    """Search reads the merchant, the note and the tags, so a described row can be found."""
    if flow:
        stmt = stmt.where(flows.condition(flow))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Transaction.merchant.ilike(like), Transaction.note.ilike(like), Transaction.tags.ilike(like)))
    if tag:
        stmt = stmt.where(Transaction.tags.like(tagging.like(tag)))
    return stmt


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
    tag: str | None = None,
    flow: str | None = Query(None, pattern="^(spend|income|invest|withdraw)$"),
    start: date | None = None,
    end: date | None = None,
    exclude_transfers: bool = False,
    limit: int = Query(100, le=500),
    offset: int = 0,
):
    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.account), joinedload(Transaction.category))
        .where(Transaction.household_id == hid)  # tenant scope, always
    )
    if exclude_transfers:
        stmt = stmt.where(Transaction.transfer_id.is_(None))
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
    stmt = _search(stmt, q, tag, flow)
    if start:
        stmt = stmt.where(Transaction.occurred_at >= start)
    if end:
        stmt = stmt.where(Transaction.occurred_at <= end)
    stmt = stmt.order_by(Transaction.occurred_at.desc()).limit(limit).offset(offset)
    return [_out(t) for t in db.scalars(stmt).all()]


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(body: TransactionIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    account = db.get(Account, body.account_id)
    if not account or account.household_id != hid or account.archived:
        raise HTTPException(status_code=404, detail="Account not found in this household")
    _check_category(db, hid, body.category_id)
    merchant = body.merchant.strip()
    if not merchant:
        raise HTTPException(status_code=422, detail="merchant: say who it was with, e.g. Swiggy or Rent")

    fields = body.model_dump(exclude={"tags", "merchant"})
    if not fields["category_id"]:
        # a known merchant or a user rule files the row; anything else stays uncategorised, not guessed
        guess = cat.categorise(merchant, cat.load_rules(db, hid), cat.category_lookup(db, hid))
        if not guess.needs_review:
            fields["category_id"] = guess.category_id
    t = Transaction(household_id=hid, merchant=merchant, tags=tagging.encode(body.tags), **fields)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _out(t)


def _check_category(db: Session, hid: str, category_id: str | None) -> None:
    if category_id:
        category = db.get(Category, category_id)
        if not category or category.household_id != hid:
            raise HTTPException(status_code=404, detail="Category not found in this household")


@router.patch("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: str,
    category_id: str | None = None,
    note: str | None = None,
    body: TransactionPatch | None = Body(default=None),
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
):
    """Recategorise, describe and tag a row. Query params remain for older clients."""
    t = db.get(Transaction, tx_id)
    if not t or t.household_id != hid:
        raise HTTPException(status_code=404, detail="Transaction not found")

    changes = body.model_dump(exclude_unset=True) if body else {}
    if category_id is not None:
        changes.setdefault("category_id", category_id)
    if note is not None:
        changes.setdefault("note", note)

    if "category_id" in changes:
        new_category = changes["category_id"] or None
        _check_category(db, hid, new_category)
        t.category_id = new_category
        t.needs_review = False
        t.confidence = 1.0
    if "note" in changes:
        t.note = (changes["note"] or "").strip()
    if "tags" in changes:
        t.tags = tagging.encode(changes["tags"])
    if changes.get("merchant"):
        t.merchant = changes["merchant"].strip()

    money_edits = {k: changes[k] for k in ("amount", "occurred_at", "direction") if changes.get(k) is not None}
    if money_edits:
        if t.transfer_id:
            raise HTTPException(
                status_code=409,
                detail="This is one half of a transfer; delete the transfer and record it again to change it",
            )
        for field, value in money_edits.items():
            setattr(t, field, value)
        t.dedupe_hash = None  # an edited imported row no longer matches its statement line
    db.commit()
    db.refresh(t)
    return _out(t)


def _remove(db: Session, hid: str, ids: list[str]) -> int:
    """Delete rows, taking both halves of any transfer, and unlink goal contributions."""
    rows = db.scalars(select(Transaction).where(Transaction.household_id == hid, Transaction.id.in_(ids))).all()
    transfer_ids = {r.transfer_id for r in rows if r.transfer_id}
    if transfer_ids:
        rows = list(rows) + [
            r
            for r in db.scalars(
                select(Transaction).where(Transaction.household_id == hid, Transaction.transfer_id.in_(transfer_ids))
            )
            if r.id not in {x.id for x in rows}
        ]
    doomed = [r.id for r in rows]
    if not doomed:
        return 0
    for contribution in db.scalars(select(GoalContribution).where(GoalContribution.transaction_id.in_(doomed))):
        contribution.transaction_id = None
    for r in rows:
        db.delete(r)
    db.commit()
    return len(doomed)


@router.post("/bulk-delete", response_model=DeletedOut)
def bulk_delete(body: BulkDeleteIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    deleted = _remove(db, hid, body.ids)
    if not deleted:
        raise HTTPException(status_code=404, detail="No matching transactions")
    return DeletedOut(deleted=deleted)


@router.delete("/{tx_id}", response_model=DeletedOut)
def delete_transaction(tx_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """Remove a row. A transfer has two halves; removing one removes both, so balances stay true."""
    deleted = _remove(db, hid, [tx_id])
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return DeletedOut(deleted=deleted)


@router.get("/summary", response_model=SummaryOut)
def summary(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    month = date.today().replace(day=1)

    def total(flow: str) -> int:
        return int(db.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.household_id == hid, Transaction.occurred_at >= month, flows.condition(flow)
            )
        ) or 0)

    count = db.scalar(
        select(func.count()).where(Transaction.household_id == hid, Transaction.occurred_at >= month)
    ) or 0
    spent, income = total("spend"), total("income")
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
    flow: str = Query("spend", pattern="^(spend|income|invest|withdraw)$"),
    start: date | None = None,
    end: date | None = None,
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
):
    """Rows grouped for charts, by flow: spending by default, or income, investing, withdrawals."""
    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.household_id == hid, flows.condition(flow))
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
    tag: str | None = None,
    flow: str | None = Query(None, pattern="^(spend|income|invest|withdraw)$"),
    start: date | None = None,
    end: date | None = None,
    exclude_transfers: bool = False,
):
    """How many rows match the same filters the list is using, and what they add up to."""
    stmt = select(Transaction).where(Transaction.household_id == hid)
    if exclude_transfers:
        stmt = stmt.where(Transaction.transfer_id.is_(None))
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
    stmt = _search(stmt, q, tag, flow)
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
        tags=tagging.decode(tx.tags),
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
