"""Statement import: preview, then commit. Nothing touches the ledger in between."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Account, GoalContribution, ImportBatch, ImportRow, Transaction
from ..schemas import (
    DeletedOut,
    ImportBatchOut,
    ImportCommitIn,
    ImportPreviewIn,
    ImportPreviewOut,
    ImportRowOut,
)
from ..services import categorise as cat
from ..services import csv_import

router = APIRouter(prefix="/imports", tags=["imports"])


def _batch_out(batch: ImportBatch, warnings: list[str] | None = None) -> ImportBatchOut:
    return ImportBatchOut(
        id=batch.id,
        account_id=batch.account_id,
        filename=batch.filename,
        status=batch.status,
        row_count=batch.row_count,
        duplicate_count=batch.duplicate_count,
        review_count=batch.review_count,
        imported_count=batch.imported_count,
        created_at=batch.created_at.isoformat() if batch.created_at else None,
        mapping=json.loads(batch.mapping) if batch.mapping else {},
        warnings=warnings or [],
    )


def _row_out(row: ImportRow, category_name: str | None) -> ImportRowOut:
    return ImportRowOut(
        id=row.id,
        line_no=row.line_no,
        occurred_at=row.occurred_at,
        description=row.description,
        merchant=row.merchant,
        direction=row.direction,
        amount=row.amount,
        category_id=row.category_id,
        category_name=category_name,
        confidence=row.confidence,
        reason=row.reason,
        is_duplicate=row.is_duplicate,
        status=row.status,
    )


@router.post("/preview", response_model=ImportPreviewOut, status_code=201)
def preview(body: ImportPreviewIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    account = db.get(Account, body.account_id)
    if not account or account.household_id != hid:
        raise HTTPException(status_code=404, detail="Account not found in this household")

    try:
        mapping, parsed, warnings = csv_import.build_candidates(body.csv, account.id, body.mapping)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not parsed:
        raise HTTPException(status_code=422, detail="No readable rows in that file")

    batch = ImportBatch(
        household_id=hid,
        account_id=account.id,
        filename=body.filename,
        status="preview",
        row_count=len(parsed),
        mapping=csv_import.mapping_to_json(mapping),
    )
    db.add(batch)
    db.flush()

    existing = set(
        db.scalars(
            select(Transaction.dedupe_hash).where(
                Transaction.household_id == hid,
                Transaction.account_id == account.id,
                Transaction.dedupe_hash.is_not(None),
            )
        )
    )
    rules = cat.load_rules(db, hid)
    categories = cat.category_lookup(db, hid)
    names = {cid: name for name, cid in categories.items()}

    duplicates = reviews = 0
    rows_out: list[ImportRowOut] = []

    for parsed_row in parsed:
        result = cat.categorise(parsed_row.description, rules, categories)
        digest = csv_import.dedupe_hash(account.id, parsed_row.occurred_at, parsed_row.amount, parsed_row.description)
        is_duplicate = digest in existing
        existing.add(digest)  # also catches repeats inside the same file

        if is_duplicate:
            status = "duplicate"
            duplicates += 1
        elif result.needs_review:
            status = "review"
            reviews += 1
        else:
            status = "ready"

        row = ImportRow(
            batch_id=batch.id,
            line_no=parsed_row.line_no,
            occurred_at=parsed_row.occurred_at,
            description=parsed_row.description,
            merchant=result.merchant,
            direction=parsed_row.direction,
            amount=parsed_row.amount,
            category_id=result.category_id,
            confidence=result.confidence,
            reason=result.reason,
            dedupe_hash=digest,
            is_duplicate=is_duplicate,
            status=status,
        )
        db.add(row)
        db.flush()
        rows_out.append(_row_out(row, names.get(result.category_id or "")))

    batch.duplicate_count = duplicates
    batch.review_count = reviews
    db.commit()

    return ImportPreviewOut(batch=_batch_out(batch, warnings), rows=rows_out)


@router.get("", response_model=list[ImportBatchOut])
def list_batches(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(ImportBatch).where(ImportBatch.household_id == hid).order_by(ImportBatch.created_at.desc()).limit(50)
    )
    return [_batch_out(b) for b in rows]


@router.get("/{batch_id}", response_model=ImportPreviewOut)
def get_batch(batch_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    batch = db.get(ImportBatch, batch_id)
    if not batch or batch.household_id != hid:
        raise HTTPException(status_code=404, detail="Import not found")

    categories = cat.category_lookup(db, hid)
    names = {cid: name for name, cid in categories.items()}
    rows = db.scalars(select(ImportRow).where(ImportRow.batch_id == batch.id).order_by(ImportRow.line_no)).all()
    return ImportPreviewOut(batch=_batch_out(batch), rows=[_row_out(r, names.get(r.category_id or "")) for r in rows])


@router.delete("/{batch_id}", response_model=DeletedOut)
def undo_import(batch_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """Throw away a preview, or take back everything a committed import added."""
    batch = db.get(ImportBatch, batch_id)
    if not batch or batch.household_id != hid:
        raise HTTPException(status_code=404, detail="Import not found")

    ids = list(db.scalars(select(Transaction.id).where(Transaction.household_id == hid, Transaction.import_batch_id == batch.id)))
    for contribution in db.scalars(select(GoalContribution).where(GoalContribution.transaction_id.in_(ids))) if ids else []:
        contribution.transaction_id = None
    for tx in db.scalars(select(Transaction).where(Transaction.id.in_(ids))) if ids else []:
        db.delete(tx)
    for row in db.scalars(select(ImportRow).where(ImportRow.batch_id == batch.id)):
        db.delete(row)
    db.delete(batch)
    db.commit()
    return DeletedOut(deleted=len(ids))


@router.post("/{batch_id}/commit", response_model=ImportBatchOut)
def commit(
    batch_id: str,
    body: ImportCommitIn | None = None,
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
):
    batch = db.get(ImportBatch, batch_id)
    if not batch or batch.household_id != hid:
        raise HTTPException(status_code=404, detail="Import not found")
    if batch.status == "committed":
        # Idempotent: a retried commit returns the same batch, it never imports twice.
        return _batch_out(batch)

    decisions = {d.row_id: d for d in (body.decisions if body and body.decisions else [])}
    rows = db.scalars(select(ImportRow).where(ImportRow.batch_id == batch.id).order_by(ImportRow.line_no)).all()

    existing = set(
        db.scalars(
            select(Transaction.dedupe_hash).where(
                Transaction.household_id == hid,
                Transaction.account_id == batch.account_id,
                Transaction.dedupe_hash.is_not(None),
            )
        )
    )

    imported = 0
    for row in rows:
        decision = decisions.get(row.id)
        if decision and decision.action == "skip":
            row.status = "skipped"
            continue
        if row.is_duplicate or row.dedupe_hash in existing:
            row.status = "duplicate"
            continue

        category_id = (decision.category_id if decision else None) or row.category_id
        db.add(
            Transaction(
                household_id=hid,
                account_id=batch.account_id,
                direction=row.direction,
                amount=row.amount,
                occurred_at=row.occurred_at,
                merchant=row.merchant,
                category_id=category_id,
                note=row.description,
                source="import",
                confidence=row.confidence,
                needs_review=row.confidence < cat.REVIEW_THRESHOLD,
                dedupe_hash=row.dedupe_hash,
                import_batch_id=batch.id,
            )
        )
        existing.add(row.dedupe_hash)
        row.status = "imported"
        row.category_id = category_id
        imported += 1

    batch.status = "committed"
    batch.imported_count = imported
    db.commit()
    return _batch_out(batch)
