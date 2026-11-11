from datetime import date
from pydantic import BaseModel, EmailStr, Field


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=120)
    household_name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AccountIn(BaseModel):
    name: str
    type: str = "bank"
    institution: str = ""
    masked_number: str = ""
    opening_balance: int = 0  # paise


class AccountOut(AccountIn):
    id: str
    balance: int


class CategoryIn(BaseModel):
    name: str
    parent_id: str | None = None
    kind: str = "expense"
    colour: str = "green"


class CategoryOut(CategoryIn):
    id: str


class TransactionIn(BaseModel):
    account_id: str
    amount: int = Field(gt=0)  # paise
    direction: str = "debit"
    occurred_at: date
    merchant: str
    category_id: str | None = None
    note: str = ""


class TransactionOut(BaseModel):
    id: str
    account_id: str
    amount: int
    direction: str
    occurred_at: date
    merchant: str
    category_id: str | None
    note: str
    source: str
    account_name: str | None = None
    category_name: str | None = None


class SummaryOut(BaseModel):
    spent: int
    income: int
    net: int
    count: int
