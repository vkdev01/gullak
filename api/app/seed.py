import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from .models import Account, Category, Merchant, Transaction

DEFAULT_CATS = {
    "Food & drink": ["Groceries", "Dining", "Delivery", "Coffee"],
    "Housing": ["Rent", "Electricity", "Internet", "Maintenance"],
    "Transport": ["Cab", "Fuel", "Train", "Metro", "Vehicle service", "Parking & tolls"],
    "Shopping": ["Clothing", "Electronics", "Home"],
    "Health": ["Pharmacy", "Doctor", "Fitness"],
    "Entertainment": ["Subscriptions", "Movies", "Events"],
    "Loans & EMIs": ["Vehicle loan", "Home loan", "Personal loan"],
    "Money": ["Fees", "Interest", "Insurance"],
    "Other": ["Miscellaneous", "Gifts", "Education", "Personal care"],
    "Savings & investments": [
        "Mutual funds / SIP", "Stocks", "Fixed deposit", "Recurring deposit", "PPF", "EPF / VPF", "NPS", "Gold",
    ],
    "Income": ["Salary", "Bonus", "Freelance", "Interest earned", "Dividends", "Rental income", "Refund"],
}
KINDS = {"Income": "income", "Savings & investments": "saving"}
COLOURS = ["green", "clay", "butter"]

MERCHANTS = [
    ("Swiggy", "Dining", 1, (180, 620)), ("Zomato", "Dining", 1, (200, 700)),
    ("Blinkit", "Groceries", 2, (240, 1400)), ("Zepto", "Groceries", 1, (200, 1200)),
    ("BigBasket", "Groceries", 2, (900, 3800)), ("DMart", "Groceries", 1, (1200, 4200)),
    ("Third Wave Coffee", "Coffee", 1, (140, 420)), ("Blue Tokai", "Coffee", 1, (180, 520)),
    ("Uber", "Cab", 2, (90, 480)), ("Ola", "Cab", 1, (80, 420)),
    ("Netflix", "Subscriptions", 0, (649, 649)), ("Hotstar", "Subscriptions", 0, (299, 299)),
    ("Spotify", "Subscriptions", 0, (119, 119)), ("Cult.fit", "Fitness", 0, (1499, 1499)),
    ("Apollo Pharmacy", "Pharmacy", 1, (120, 900)), ("Amazon", "Electronics", 2, (300, 4500)),
    ("Myntra", "Clothing", 1, (600, 3200)), ("Jio", "Internet", 0, (799, 799)),
    ("IRCTC", "Train", 0, (450, 1800)),
]


def seed_categories(db: Session, household_id: str) -> int:
    """Create any default category the household is missing, matched by name. Safe to run again."""
    existing = db.query(Category).filter(Category.household_id == household_id).all()
    created = 0
    for i, (parent, kids) in enumerate(DEFAULT_CATS.items()):
        p = next((c for c in existing if c.parent_id is None and c.name.lower() == parent.lower()), None)
        if p is None:
            p = Category(household_id=household_id, name=parent, kind=KINDS.get(parent, "expense"), colour=COLOURS[i % 3])
            db.add(p)
            db.flush()
            created += 1
        names = {c.name.lower() for c in existing if c.parent_id == p.id}
        for k in kids:
            if k.lower() not in names:
                db.add(Category(household_id=household_id, parent_id=p.id, name=k, kind=p.kind, colour=p.colour))
                created += 1
    db.flush()
    return created


def seed_demo(db: Session, household_id: str, days: int = 180) -> int:
    cats = {c.name: c.id for c in db.query(Category).filter(Category.household_id == household_id)}
    accounts = db.query(Account).filter(Account.household_id == household_id).all()
    if not accounts:
        bank = Account(household_id=household_id, name="HDFC Savings", type="bank",
                       institution="HDFC", masked_number="8842", opening_balance=4_250_000)
        card = Account(household_id=household_id, name="HDFC Credit Card", type="credit_card",
                       institution="HDFC", masked_number="4412", opening_balance=0)
        cash = Account(household_id=household_id, name="Cash", type="cash", opening_balance=4_000_000)
        db.add_all([bank, card, cash])
        db.flush()
        accounts = [bank, card, cash]
    else:
        bank = accounts[0]
        card = accounts[1] if len(accounts) > 1 else accounts[0]
        cash = accounts[2] if len(accounts) > 2 else accounts[0]

    for name, cat, *_ in MERCHANTS:
        exists = db.query(Merchant).filter(Merchant.household_id == household_id, Merchant.name == name).first()
        if not exists:
            db.add(Merchant(household_id=household_id, name=name, default_category_id=cats.get(cat)))

    def money(a, b):
        return round(random.uniform(a, b) / 10) * 10 * 100  # paise, rounded to ₹10

    start = date.today() - timedelta(days=days - 1)
    made = 0
    for d in range(days):
        day = start + timedelta(days=d)
        n = random.randint(3, 5) if day.weekday() >= 5 else random.randint(2, 4)
        for _ in range(n):
            name, cat, weight, (lo, hi) = random.choice(MERCHANTS)
            if random.random() > (weight + 5) / 10:
                continue
            acct = bank if random.random() < 0.55 else (card if random.random() < 0.7 else cash)
            db.add(Transaction(household_id=household_id, account_id=acct.id, direction="debit",
                               amount=money(lo, hi), occurred_at=day, merchant=name,
                               category_id=cats.get(cat), source="seed"))
            made += 1
        if day.day == 1:
            db.add(Transaction(household_id=household_id, account_id=bank.id, direction="credit",
                               amount=14_200_000, occurred_at=day, merchant="Salary — Acme",
                               category_id=cats.get("Salary"), source="seed"))
            db.add(Transaction(household_id=household_id, account_id=bank.id, direction="debit",
                               amount=3_200_000, occurred_at=day, merchant="Rent",
                               category_id=cats.get("Rent"), source="seed"))
            made += 2
    db.commit()
    return made
