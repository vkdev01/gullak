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
    name: str = Field(min_length=1, max_length=120)
    type: str = "bank"
    institution: str = ""
    masked_number: str = ""
    opening_balance: int = 0  # paise
    description: str = Field(default="", max_length=2000)
    interest_rate: float | None = Field(default=None, ge=0, le=100)
    maturity_date: date | None = None
    monthly_amount: int | None = Field(default=None, ge=0)
    current_value: int | None = Field(default=None, ge=0)


class AccountPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    institution: str | None = None
    masked_number: str | None = None
    description: str | None = Field(default=None, max_length=2000)
    interest_rate: float | None = Field(default=None, ge=0, le=100)
    maturity_date: date | None = None
    monthly_amount: int | None = Field(default=None, ge=0)
    current_value: int | None = Field(default=None, ge=0)


class AccountOut(AccountIn):
    id: str
    kind: str = "spending"  # spending | investment
    balance: int  # opening balance plus every row: what went in minus what came out
    value: int = 0  # current_value when known, else balance
    gain: int | None = None
    value_as_of: date | None = None
    contributed_this_period: int = 0


class PeriodFlowOut(BaseModel):
    period_start: date
    period_end: date
    label: str
    income: int
    spent: int
    invested: int
    withdrawn: int
    saved: int  # income - spent
    savings_rate: float | None  # saved / income, %
    invest_rate: float | None  # invested / income, %


class MoneySummaryOut(BaseModel):
    periods: list[PeriodFlowOut]
    income_by_source: list["GroupRow"]
    invested_by_type: list["GroupRow"]
    net_worth: int
    liquid: int
    investments: int
    owed: int


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
    note: str = Field(default="", max_length=2000)
    tags: list[str] = []


class TransactionPatch(BaseModel):
    category_id: str | None = None
    note: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = None
    merchant: str | None = Field(default=None, min_length=1, max_length=160)


class TransactionOut(BaseModel):
    id: str
    account_id: str
    amount: int
    direction: str
    occurred_at: date
    merchant: str
    category_id: str | None
    note: str
    tags: list[str] = []
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


# ---------------------------------------------------------------- planning

class BudgetIn(BaseModel):
    name: str = ""
    category_id: str | None = None
    period: str = "monthly"
    amount: int = Field(gt=0)  # paise
    rollover: bool = False
    fixed: bool = False


class BudgetPatch(BaseModel):
    name: str | None = None
    amount: int | None = Field(default=None, gt=0)
    rollover: bool | None = None
    fixed: bool | None = None
    is_active: bool | None = None


class BudgetOut(BaseModel):
    id: str
    name: str
    category_id: str | None
    period: str
    amount: int
    rollover: bool
    fixed: bool = False
    is_active: bool


class BudgetStatusOut(BaseModel):
    id: str
    name: str
    category_id: str | None
    category_name: str | None
    parent_id: str | None = None
    scope: str = "category"  # overall | group | category
    period_start: date
    period_end: date
    allocated: int
    carried: int
    spent: int
    remaining: int
    used_pct: float
    elapsed_pct: float
    status: str
    rollover: bool
    fixed: bool = False
    category_kind: str | None = None
    days_left: int = 0
    daily_allowance: int = 0
    projected: int | None = None


class BudgetSuggestionOut(BaseModel):
    category_id: str | None
    average: int
    periods: int


class HouseholdOut(BaseModel):
    id: str
    name: str
    currency: str
    cycle_start_day: int


class HouseholdPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    cycle_start_day: int | None = Field(default=None, ge=1, le=28)


class GoalIn(BaseModel):
    name: str
    target: int = Field(gt=0)
    target_date: date | None = None
    monthly_target: int | None = Field(default=None, gt=0)
    account_id: str | None = None


class ContributionIn(BaseModel):
    amount: int = Field(gt=0)
    contributed_on: date | None = None
    note: str = ""


class GoalOut(BaseModel):
    id: str
    name: str
    target: int
    contributed: int
    progress_pct: float
    monthly_target: int | None
    target_date: date | None
    projected_finish: date | None
    status: str


class SeriesOut(BaseModel):
    merchant: str
    cadence: str
    occurrences: int
    expected_amount: int
    last_seen: date
    next_due: date
    is_subscription: bool
    price_change: int


class DueSoonOut(BaseModel):
    merchant: str
    amount: int
    due: date
    cadence: str


class InsightOut(BaseModel):
    kind: str
    severity: str
    title: str
    fact_pack: dict


class SparkPoint(BaseModel):
    date: str
    amount: int


class DashboardOut(BaseModel):
    period_start: date
    period_end: date
    period_label: str
    days_left: int
    elapsed_pct: float
    income: int
    spent: int
    invested: int = 0
    savings_due: int = 0
    committed: int
    budgeted_remaining: int
    free_to_spend: int
    budgets: list[BudgetStatusOut]
    goals: list[GoalOut]
    due_soon: list[DueSoonOut]
    sparkline: list[SparkPoint]
    insights: list[InsightOut]


class TransferIn(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: int = Field(gt=0)
    occurred_at: date
    note: str = ""


class TransferOut(BaseModel):
    transfer_id: str
    from_transaction_id: str
    to_transaction_id: str


class GroupRow(BaseModel):
    key: str
    label: str
    total: int
    count: int


MoneySummaryOut.model_rebuild()


class CountOut(BaseModel):
    count: int
    out: int
    income: int
    net: int


class TransactionDetailOut(BaseModel):
    id: str
    account_id: str
    account_name: str | None
    amount: int
    direction: str
    occurred_at: date
    merchant: str
    note: str
    tags: list[str] = []
    category_id: str | None
    category_name: str | None
    category_parent: str | None
    source: str
    confidence: float
    needs_review: bool
    transfer_id: str | None
    dedupe_hash: str | None
    created_at: str | None
    import_filename: str | None
    import_batch_id: str | None
