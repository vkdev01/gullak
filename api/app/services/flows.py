"""What a row means for the household's money, decided in one place.

  spend     money out of a spending account, not a transfer, not saved or invested
  income    money into a spending account, not a transfer, not a redemption
  invest    money into a savings/investment account (transfer or contribution such as EPF),
            or a debit from a spending account filed under a "saving" category (an imported SIP)
  withdraw  money out of a savings/investment account, or a credit filed under a "saving" category

Every total on the dashboard, budgets, the income page and the ledger drill-down
uses these conditions, so the same row is never counted two ways.
"""

from sqlalchemy import and_, or_, select

from ..models import Account, Category, Transaction

SPENDING_TYPES = ("bank", "credit_card", "cash", "wallet")
INVESTMENT_TYPES = ("fd", "rd", "ppf", "epf", "nps", "mutual_fund", "stocks", "gold", "other_investment")
ACCOUNT_TYPES = SPENDING_TYPES + INVESTMENT_TYPES
FLOWS = ("spend", "income", "invest", "withdraw")


def is_investment(account_type: str) -> bool:
    return account_type in INVESTMENT_TYPES


def condition(flow: str):
    in_investment = Transaction.account_id.in_(select(Account.id).where(Account.type.in_(INVESTMENT_TYPES)))
    saving = Transaction.category_id.in_(select(Category.id).where(Category.kind == "saving"))
    not_saving = or_(Transaction.category_id.is_(None), ~saving)
    own = Transaction.transfer_id.is_(None)
    debit = Transaction.direction == "debit"
    credit = Transaction.direction == "credit"

    if flow == "spend":
        return and_(debit, own, ~in_investment, not_saving)
    if flow == "income":
        return and_(credit, own, ~in_investment, not_saving)
    if flow == "invest":
        return or_(and_(credit, in_investment), and_(debit, own, ~in_investment, saving))
    if flow == "withdraw":
        return or_(and_(debit, in_investment), and_(credit, own, ~in_investment, saving))
    raise ValueError(f"unknown flow {flow!r}")
