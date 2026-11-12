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
    confidence: float = 1.0
    needs_review: bool = False
    account_name: str | None = None
    category_name: str | None = None


class SummaryOut(BaseModel):
    spent: int
    income: int
    net: int
    count: int


class RuleIn(BaseModel):
    pattern: str = Field(min_length=2, max_length=200)
    category_id: str
    name: str = ""
    match_type: str = "contains"
    priority: int = 100


class RuleOut(BaseModel):
    id: str
    pattern: str
    category_id: str
    category_name: str | None = None
    name: str
    match_type: str
    priority: int


class ImportPreviewIn(BaseModel):
    account_id: str
    filename: str = "statement.csv"
    csv: str = Field(min_length=1)
    mapping: dict[str, str] | None = None


class ImportRowOut(BaseModel):
    id: str
    line_no: int
    occurred_at: date
    description: str
    merchant: str
    direction: str
    amount: int
    category_id: str | None
    category_name: str | None = None
    confidence: float
    reason: str
    is_duplicate: bool
    status: str


class ImportBatchOut(BaseModel):
    id: str
    account_id: str
    filename: str
    status: str
    row_count: int
    duplicate_count: int
    review_count: int
    imported_count: int
    created_at: str | None = None
    mapping: dict[str, str] = {}
    warnings: list[str] = []


class ImportPreviewOut(BaseModel):
    batch: ImportBatchOut
    rows: list[ImportRowOut]


class ImportDecision(BaseModel):
    row_id: str
    action: str = "import"  # import | skip
    category_id: str | None = None


class ImportCommitIn(BaseModel):
    decisions: list[ImportDecision] | None = None


class BulkCategoriseIn(BaseModel):
    ids: list[str] = Field(min_length=1)
    category_id: str


class BulkCategoriseOut(BaseModel):
    updated: int


class ReviewRowOut(TransactionOut):
    suggested_category_id: str | None = None
