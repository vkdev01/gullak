import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from .deps import current_household_id
from .models import User
from .deps import current_user
from .routers import accounts, auth, budgets, categories, dashboard, goals, household, imports, money, rules, transactions
from .seed import seed_demo


def _upgrade_dev_sqlite() -> None:
    """create_all never alters an existing table, so add columns newer than the dev database."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    missing = [
        (table, column, ddl)
        for table, column, ddl in [
            ("transactions", "tags", "TEXT NOT NULL DEFAULT ''"),
            ("budgets", "fixed", "BOOLEAN NOT NULL DEFAULT 0"),
            ("accounts", "description", "TEXT NOT NULL DEFAULT ''"),
            ("accounts", "interest_rate", "FLOAT"),
            ("accounts", "maturity_date", "DATE"),
            ("accounts", "monthly_amount", "BIGINT"),
            ("accounts", "current_value", "BIGINT"),
            ("accounts", "value_as_of", "DATE"),
            ("goal_contributions", "created_at", "DATETIME"),
        ]
        if inspector.has_table(table) and column not in {c["name"] for c in inspector.get_columns(table)}
    ]
    with engine.begin() as conn:
        for table, column, ddl in missing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # dev convenience; production applies migrations/*.sql instead
    Base.metadata.create_all(bind=engine)
    _upgrade_dev_sqlite()
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
app.include_router(household.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(transactions.transfers)
app.include_router(budgets.router)
app.include_router(money.router)
app.include_router(goals.router)
app.include_router(dashboard.router)
app.include_router(imports.router)
app.include_router(rules.router)

