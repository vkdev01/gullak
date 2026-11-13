from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_household_id
from ..models import Goal, GoalContribution
from ..schemas import ContributionIn, GoalIn, GoalOut
from ..services import plan

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
def list_goals(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    return [GoalOut(**vars(g)) for g in plan.goal_statuses(db, hid, date.today())]


@router.post("", response_model=GoalOut, status_code=201)
def create_goal(body: GoalIn, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    goal = Goal(household_id=hid, **body.model_dump())
    db.add(goal)
    db.commit()
    status = next(g for g in plan.goal_statuses(db, hid, date.today()) if g.id == goal.id)
    return GoalOut(**vars(status))


@router.post("/{goal_id}/contributions", response_model=GoalOut)
def contribute(
    goal_id: str,
    body: ContributionIn,
    hid: str = Depends(current_household_id),
    db: Session = Depends(get_db),
):
    goal = db.get(Goal, goal_id)
    if not goal or goal.household_id != hid:
        raise HTTPException(status_code=404, detail="Goal not found")

    db.add(
        GoalContribution(
            goal_id=goal.id,
            amount=body.amount,
            contributed_on=body.contributed_on or date.today(),
            note=body.note,
        )
    )
    db.commit()
    status = next(g for g in plan.goal_statuses(db, hid, date.today()) if g.id == goal.id)
    return GoalOut(**vars(status))


@router.delete("/{goal_id}/contributions/latest", response_model=GoalOut)
def undo_last_contribution(goal_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    goal = db.get(Goal, goal_id)
    if not goal or goal.household_id != hid:
        raise HTTPException(status_code=404, detail="Goal not found")
    last = db.scalars(
        select(GoalContribution)
        .where(GoalContribution.goal_id == goal.id)
        .order_by(GoalContribution.contributed_on.desc(), GoalContribution.created_at.desc())
    ).first()
    if not last:
        raise HTTPException(status_code=404, detail="Nothing to undo: no contributions yet")
    db.delete(last)
    db.commit()
    status = next(g for g in plan.goal_statuses(db, hid, date.today()) if g.id == goal.id)
    return GoalOut(**vars(status))


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: str, hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    goal = db.get(Goal, goal_id)
    if not goal or goal.household_id != hid:
        raise HTTPException(status_code=404, detail="Goal not found")
    for contribution in db.scalars(select(GoalContribution).where(GoalContribution.goal_id == goal.id)):
        db.delete(contribution)
    db.delete(goal)
    db.commit()
