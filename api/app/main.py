import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from .deps import current_household_id
from .models import User
from .deps import current_user
from .routers import accounts, auth, budgets, categories, dashboard, goals, imports, rules, transactions
from .seed import seed_demo

@asynccontextmanager
async def lifespan(app: FastAPI):
    # dev convenience; production applies migrations/001_init.sql instead
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Gullak API", version="0.1.0 (MVP 0)", lifespan=lifespan)

# The browser origin is configuration, not a constant: Next picks 3001 when 3000
# is busy, and 127.0.0.1 is a different origin from localhost. WEB_ORIGIN takes a
# comma-separated list for anything else (a deployed web app, a tunnel).
_default_origins = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"
_origins = [o.strip() for o in os.getenv("WEB_ORIGIN", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
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
app.include_router(transactions.transfers)
app.include_router(budgets.router)
app.include_router(goals.router)
app.include_router(dashboard.router)
app.include_router(imports.router)
app.include_router(rules.router)

