import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from .deps import current_household_id
from .models import User
from .deps import current_user
from .routers import accounts, auth, categories, imports, rules, transactions
from .seed import seed_demo

@asynccontextmanager
async def lifespan(app: FastAPI):
    # dev convenience; production applies migrations/001_init.sql instead
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Gullak API", version="0.1.0 (MVP 0)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("WEB_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/me")
def me(user: User = Depends(current_user), hid: str = Depends(current_household_id)):
    return {"id": user.id, "email": user.email, "name": user.name,
            "timezone": user.timezone, "currency": user.currency, "household_id": hid}


@app.post("/demo/seed")
def demo_seed(hid: str = Depends(current_household_id), db: Session = Depends(get_db)):
    return {"created": seed_demo(db, hid)}


app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(imports.router)
app.include_router(rules.router)
