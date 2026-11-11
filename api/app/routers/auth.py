from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Household, Membership, User
from ..schemas import LoginIn, SignupIn, TokenOut
from ..security import create_token, hash_password, verify_password
from ..seed import seed_categories

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenOut, status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email.lower())):
        raise HTTPException(status_code=409, detail="That email already has an account")
    user = User(email=body.email.lower(), name=body.name, password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    household = Household(name=body.household_name or f"{body.name.split()[0]}'s household")
    db.add(household)
    db.flush()
    db.add(Membership(household_id=household.id, user_id=user.id, role="owner"))
    seed_categories(db, household.id)
    db.commit()
    return TokenOut(access_token=create_token(user.id))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return TokenOut(access_token=create_token(user.id))
