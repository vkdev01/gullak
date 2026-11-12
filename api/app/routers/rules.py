from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Category, Rule
from ..schemas import RuleIn, RuleOut

router = APIRouter(prefix="/rules", tags=["rules"])


def _out(rule: Rule, category_name: str | None) -> RuleOut:
    return RuleOut(
        id=rule.id,
        pattern=rule.pattern,
        category_id=rule.category_id,
        category_name=category_name,
        name=rule.name,
        match_type=rule.match_type,
        priority=rule.priority,
    )


@router.get("", response_model=list[RuleOut])
def list_rules(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    names = {c.id: c.name for c in db.scalars(select(Category).where(Category.household_id == hid))}
    rules = db.scalars(select(Rule).where(Rule.household_id == hid).order_by(Rule.priority, Rule.created_at))
    return [_out(r, names.get(r.category_id)) for r in rules]


@router.post("", response_model=RuleOut, status_code=201)
def create_rule(body: RuleIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    category = db.get(Category, body.category_id)
    if not category or category.household_id != hid:
        raise HTTPException(status_code=404, detail="Category not found in this household")
    if body.match_type not in {"contains", "equals", "regex"}:
        raise HTTPException(status_code=422, detail="match_type must be contains, equals or regex")

    rule = Rule(
        household_id=hid,
        pattern=body.pattern,
        category_id=body.category_id,
        name=body.name or body.pattern,
        match_type=body.match_type,
        priority=body.priority,
    )
    db.add(rule)
    db.commit()
    return _out(rule, category.name)


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    rule = db.get(Rule, rule_id)
    if not rule or rule.household_id != hid:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
