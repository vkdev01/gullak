import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Household(Base):
    __tablename__ = "households"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    cycle_start_day: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Membership(Base):
    __tablename__ = "memberships"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20), default="owner")


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(20), default="bank")
    institution: Mapped[str] = mapped_column(String(120), default="")
    masked_number: Mapped[str] = mapped_column(String(32), default="")
    opening_balance: Mapped[int] = mapped_column(BigInteger, default=0)  # paise
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    archived: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(10), default="expense")
    colour: Mapped[str] = mapped_column(String(10), default="green")


class Merchant(Base):
    __tablename__ = "merchants"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    default_category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True)


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    direction: Mapped[str] = mapped_column(String(10), default="debit")  # debit | credit
    amount: Mapped[int] = mapped_column(BigInteger)  # paise, always positive
    occurred_at: Mapped[date] = mapped_column(Date, index=True)
    merchant: Mapped[str] = mapped_column(String(160))
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(Text, default="")  # ",trip,car," — see services/tags.py
    source: Mapped[str] = mapped_column(String(20), default="manual")
    confidence: Mapped[float] = mapped_column(default=1.0)
    needs_review: Mapped[bool] = mapped_column(default=False, index=True)
    dedupe_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    import_batch_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    transfer_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    account = relationship("Account")
    category = relationship("Category")


Index("ix_tx_household_date", Transaction.household_id, Transaction.occurred_at)


class TransactionSplit(Base):
    __tablename__ = "transaction_splits"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    note: Mapped[str] = mapped_column(String(200), default="")


class Rule(Base):
    """A user-authored categorisation rule. Rules win over every heuristic."""

    __tablename__ = "rules"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    priority: Mapped[int] = mapped_column(default=100)
    match_type: Mapped[str] = mapped_column(String(12), default="contains")  # contains | equals | regex
    pattern: Mapped[str] = mapped_column(String(200))
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ImportBatch(Base):
    """One uploaded statement. Nothing reaches the ledger until it is committed."""

    __tablename__ = "import_batches"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"))
    filename: Mapped[str] = mapped_column(String(200), default="statement.csv")
    status: Mapped[str] = mapped_column(String(12), default="preview")  # preview | committed
    row_count: Mapped[int] = mapped_column(default=0)
    duplicate_count: Mapped[int] = mapped_column(default=0)
    review_count: Mapped[int] = mapped_column(default=0)
    imported_count: Mapped[int] = mapped_column(default=0)
    mapping: Mapped[str] = mapped_column(Text, default="")  # json of the column mapping used
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ImportRow(Base):
    """A parsed candidate row, kept so the preview can be re-read and audited."""

    __tablename__ = "import_rows"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.id", ondelete="CASCADE"), index=True)
    line_no: Mapped[int] = mapped_column(default=0)
    occurred_at: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(300), default="")
    merchant: Mapped[str] = mapped_column(String(160), default="")
    direction: Mapped[str] = mapped_column(String(10), default="debit")
    amount: Mapped[int] = mapped_column(BigInteger)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    confidence: Mapped[float] = mapped_column(default=0.0)
    reason: Mapped[str] = mapped_column(String(24), default="")  # rule | merchant | pattern | none
    dedupe_hash: Mapped[str] = mapped_column(String(64), default="", index=True)
    is_duplicate: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(String(12), default="ready")  # ready | review | duplicate | imported | skipped


class Budget(Base):
    """A cap for a category, or an envelope across several, for a repeating period."""

    __tablename__ = "budgets"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    period: Mapped[str] = mapped_column(String(12), default="monthly")  # monthly | weekly
    amount: Mapped[int] = mapped_column(BigInteger)  # paise
    rollover: Mapped[bool] = mapped_column(default=False)
    fixed: Mapped[bool] = mapped_column(default=False)  # a bill paid once a period: no pace, no daily allowance
    is_active: Mapped[bool] = mapped_column(default=True)
    created_on: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    target: Mapped[int] = mapped_column(BigInteger)  # paise
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    monthly_target: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="active")  # active | paused | achieved
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    goal_id: Mapped[str] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    contributed_on: Mapped[date] = mapped_column(Date, default=date.today)
    transaction_id: Mapped[str | None] = mapped_column(ForeignKey("transactions.id"), nullable=True)
    note: Mapped[str] = mapped_column(String(200), default="")
