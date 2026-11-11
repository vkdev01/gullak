from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Category
from ..schemas import CategoryIn, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    rows = db.scalars(select(Category).where(Category.household_id == hid).order_by(Category.name)).all()
    return [CategoryOut(id=c.id, name=c.name, parent_id=c.parent_id, kind=c.kind, colour=c.colour) for c in rows]


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    c = Category(household_id=hid, **body.model_dump())
    db.add(c)
    db.commit()
    return CategoryOut(id=c.id, **body.model_dump())
