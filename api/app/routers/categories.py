from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Category
from ..schemas import CategoryIn, CategoryOut
from ..seed import seed_categories

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    rows = db.scalars(select(Category).where(Category.household_id == hid).order_by(Category.name)).all()
    return [CategoryOut(id=c.id, name=c.name, parent_id=c.parent_id, kind=c.kind, colour=c.colour) for c in rows]


@router.post("/defaults", response_model=list[CategoryOut])
def add_default_categories(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """Bring an older household up to the current default list without touching what it has."""
    seed_categories(db, hid)
    db.commit()
    return list_categories(hid, db)


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="A category needs a name")
    kind, colour = body.kind, body.colour
    if body.parent_id:
        parent = db.get(Category, body.parent_id)
        if not parent or parent.household_id != hid:
            raise HTTPException(status_code=404, detail="Parent category not found in this household")
        if parent.parent_id:
            raise HTTPException(status_code=422, detail="Categories are two levels deep; pick a top-level parent")
        kind, colour = parent.kind, parent.colour  # a child always shares its parent's kind

    clash = db.scalars(
        select(Category).where(
            Category.household_id == hid,
            Category.parent_id.is_(None) if body.parent_id is None else Category.parent_id == body.parent_id,
            func.lower(Category.name) == name.lower(),
        )
    ).first()
    if clash:
        raise HTTPException(status_code=409, detail=f"“{name}” already exists there")

    c = Category(household_id=hid, name=name, parent_id=body.parent_id, kind=kind, colour=colour)
    db.add(c)
    db.commit()
    return CategoryOut(id=c.id, name=c.name, parent_id=c.parent_id, kind=c.kind, colour=c.colour)
