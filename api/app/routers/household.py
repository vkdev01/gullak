from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Household
from ..schemas import HouseholdOut, HouseholdPatch

router = APIRouter(prefix="/household", tags=["household"])


def _out(h: Household) -> HouseholdOut:
    return HouseholdOut(id=h.id, name=h.name, currency=h.currency, cycle_start_day=h.cycle_start_day)


@router.get("", response_model=HouseholdOut)
def get_household(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    household = db.get(Household, hid)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    return _out(household)


@router.patch("", response_model=HouseholdOut)
def update_household(body: HouseholdPatch, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    """cycle_start_day is the salary day: it decides where every budget period starts."""
    household = db.get(Household, hid)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(household, field, value)
    db.commit()
    return _out(household)
