from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Membership, User
from .security import decode_token


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.cookies.get("gullak_token")
    user_id = decode_token(token or "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def current_household_id(user: User = Depends(current_user), db: Session = Depends(get_db)) -> str:
    m = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not m:
        raise HTTPException(status_code=403, detail="No household for this user")
    return m.household_id
