"""MVP 2 exit criteria.

> Budget status matches a hand-built spreadsheet to the paisa, and every
> dashboard number opens to the transactions behind it.
"""

from datetime import date, timedelta

import pytest

from app.db import SessionLocal
from app.models import Budget, Transaction
from app.services.periods import elapsed_fraction, period_bounds
from app.services.plan import _rupees


def _tx(client, headers, account_id, amount, day, merchant, category_id=None, direction="debit"):
    r = client.post(
        "/transactions",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": amount,
            "occurred_at": day,
            "merchant": merchant,
            "category_id": category_id,
            "direction": direction,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _category(client, headers, name):
    return next(c for c in client.get("/categories", headers=headers).json() if c["name"] == name)


# --------------------------------------------------------------- periods

@pytest.mark.parametrize(
    "paise, text",
    [(0, "₹0"), (99_900, "₹999"), (597_000, "₹5,970"), (12_450_000, "₹1,24,500"), (1_234_567_800, "₹1,23,45,678")],
)
def test_rupees_uses_indian_grouping(paise, text):
    assert _rupees(paise) == text


def test_periods_are_salary_anchored():
    # anchor on the 25th: 12 Nov belongs to 25 Oct → 24 Nov
    start, end = period_bounds(25, date(2026, 11, 12))
    assert (start, end) == (date(2026, 10, 25), date(2026, 11, 24))

    # the 25th itself starts the new period
    start, end = period_bounds(25, date(2026, 11, 25))
    assert (start, end) == (date(2026, 11, 25), date(2026, 12, 24))

    # default anchor behaves like a calendar month
    assert period_bounds(1, date(2026, 11, 12)) == (date(2026, 11, 1), date(2026, 11, 30))

    assert elapsed_fraction(date(2026, 11, 1), date(2026, 11, 30), date(2026, 11, 15)) == pytest.approx(0.5)


# --------------------------------------------------------------- budgets

def test_budget_status_matches_a_spreadsheet(household):
    c, headers, account_id = household
    groceries = _category(c, headers, "Groceries")

    budget = c.post(
        "/budgets",
        headers=headers,
        json={"category_id": groceries["id"], "amount": 1_000_000},  # ₹10,000
    )
    assert budget.status_code == 201

    today = date.today()
    _tx(c, headers, account_id, 200_000, today.isoformat(), "BigBasket", groceries["id"])
    _tx(c, headers, account_id, 300_000, today.isoformat(), "DMart", groceries["id"])

    status = next(b for b in c.get("/budgets/status", headers=headers).json() if b["id"] == budget.json()["id"])

    assert status["allocated"] == 1_000_000
    assert status["spent"] == 500_000
    assert status["remaining"] == 500_000
    assert status["used_pct"] == 50.0
    assert status["status"] == "on_track"


def test_rollover_carries_the_previous_period(household):
    c, headers, account_id = household
    groceries = _category(c, headers, "Groceries")

    created = c.post(
        "/budgets",
        headers=headers,
        json={"category_id": groceries["id"], "amount": 1_000_000, "rollover": True},
    ).json()

    # backdate the budget one period and spend ₹6,000 inside it
    with SessionLocal() as db:
        budget = db.get(Budget, created["id"])
        budget.created_on = date.today().replace(day=1) - timedelta(days=1)  # one period back
        db.commit()

    prev_spend_day = (date.today().replace(day=1) - timedelta(days=15)).isoformat()
    _tx(c, headers, account_id, 600_000, prev_spend_day, "BigBasket", groceries["id"])

    status = next(b for b in c.get("/budgets/status", headers=headers).json() if b["id"] == created["id"])
    assert status["carried"] == 400_000          # ₹4,000 unspent carried forward
    assert status["allocated"] == 1_400_000


def test_overspend_is_marked_over(household):
    c, headers, account_id = household
    dining = _category(c, headers, "Dining")
    c.post("/budgets", headers=headers, json={"category_id": dining["id"], "amount": 100_000})
    _tx(c, headers, account_id, 150_000, date.today().isoformat(), "Swiggy", dining["id"])

    status = next(b for b in c.get("/budgets/status", headers=headers).json() if b["category_id"] == dining["id"])
    assert status["status"] == "over"
    assert status["remaining"] == -50_000


# --------------------------------------------------------------- goals

def test_goal_progress_and_projection(household):
    c, headers, _ = household
    goal = c.post(
        "/goals",
        headers=headers,
        json={"name": "Goa trip", "target": 5_000_000, "monthly_target": 1_000_000},
    )
    assert goal.status_code == 201

    after = c.post(
        f"/goals/{goal.json()['id']}/contributions",
        headers=headers,
        json={"amount": 2_500_000},
    ).json()

    assert after["contributed"] == 2_500_000
    assert after["progress_pct"] == 50.0
    assert after["projected_finish"] is not None


# --------------------------------------------------------------- transfers

def test_transfers_are_not_spending(household):
    c, headers, account_id = household
    card = c.post("/accounts", headers=headers, json={"name": "Credit Card", "type": "credit_card"}).json()

    before = c.get("/transactions/summary", headers=headers).json()["spent"]

    transfer = c.post(
        "/transfers",
        headers=headers,
        json={
            "from_account_id": account_id,
            "to_account_id": card["id"],
            "amount": 500_000,
            "occurred_at": date.today().isoformat(),
            "note": "card payment",
        },
    )
    assert transfer.status_code == 201

    # two legs exist, but the spend total does not move
    assert c.get("/transactions/summary", headers=headers).json()["spent"] == before
    assert len(c.get("/transactions", headers=headers).json()) == 2
    assert c.get("/dashboard", headers=headers).json()["spent"] == 0


# --------------------------------------------------------------- dashboard

def test_free_to_spend_identity(household):
    c, headers, account_id = household
    groceries = _category(c, headers, "Groceries")

    _tx(c, headers, account_id, 10_000_000, date.today().isoformat(), "Salary", _category(c, headers, "Salary")["id"], "credit")
    _tx(c, headers, account_id, 200_000, date.today().isoformat(), "BigBasket", groceries["id"])
    c.post("/budgets", headers=headers, json={"category_id": groceries["id"], "amount": 1_000_000})

    d = c.get("/dashboard", headers=headers).json()

    assert d["income"] == 10_000_000
    assert d["spent"] == 200_000
    assert d["budgeted_remaining"] == 800_000
    # the identity the hero number depends on
    assert d["free_to_spend"] == d["income"] - d["spent"] - d["committed"] - d["budgeted_remaining"]
    assert d["free_to_spend"] == 10_000_000 - 200_000 - 800_000
    assert len(d["sparkline"]) > 20
    assert d["period_label"]


def test_every_insight_has_a_fact_pack(household):
    c, headers, account_id = household
    groceries = _category(c, headers, "Groceries")

    # same number of days into the previous period, because that is what the
    # comparison now measures — a half-finished month must not read as "down"
    prev_start = (date.today().replace(day=1) - timedelta(days=1)).replace(day=1)
    prev_day = (prev_start + timedelta(days=2)).isoformat()
    _tx(c, headers, account_id, 100_000, prev_day, "BigBasket", groceries["id"])
    _tx(c, headers, account_id, 400_000, date.today().isoformat(), "BigBasket", groceries["id"])

    d = c.get("/dashboard", headers=headers).json()
    assert d["insights"], "expected a month-delta insight"
    for insight in d["insights"]:
        assert insight["fact_pack"]
        assert insight["fact_pack"].get("query")


def test_grouped_spend_by_category(household):
    c, headers, account_id = household
    groceries = _category(c, headers, "Groceries")
    dining = _category(c, headers, "Dining")

    _tx(c, headers, account_id, 100_000, date.today().isoformat(), "BigBasket", groceries["id"])
    _tx(c, headers, account_id, 300_000, date.today().isoformat(), "Swiggy", dining["id"])

    rows = c.get("/transactions/group?by=category", headers=headers).json()
    by_label = {row["label"]: row["total"] for row in rows}
    assert by_label["Groceries"] == 100_000
    assert by_label["Dining"] == 300_000


# --------------------------------------------------------------- recurring

def test_recurring_detection_finds_a_series_and_invents_none(household):
    c, headers, account_id = household
    subs = _category(c, headers, "Subscriptions")

    # three monthly Netflix charges, same amount
    for months_back in (2, 1, 0):
        day = (date.today().replace(day=15) - timedelta(days=30 * months_back)).isoformat()
        _tx(c, headers, account_id, 64_900, day, "Netflix", subs["id"])

    # three unrelated one-off merchants must not become series
    for i, name in enumerate(["Croma", "Myntra", "IRCTC"]):
        _tx(c, headers, account_id, 100_000 + i * 50_000, (date.today() - timedelta(days=7 * i)).isoformat(), name)

    series = c.get("/recurring", headers=headers).json()
    merchants = [s["merchant"] for s in series]

    assert "Netflix" in merchants
    netflix = next(s for s in series if s["merchant"] == "Netflix")
    assert netflix["cadence"] == "monthly"
    assert netflix["expected_amount"] == 64_900
    assert netflix["is_subscription"] is True
    assert "Croma" not in merchants


# --------------------------------------------------------------- isolation

def test_planning_is_scoped_to_the_household(household):
    c, headers, _ = household
    other = c.post("/auth/signup", json={"email": "b@example.com", "password": "password123", "name": "B"}).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    goal = c.post("/goals", headers=headers, json={"name": "Mine", "target": 1_000_000}).json()
    assert c.get("/goals", headers=other_headers).json() == []
    assert c.post(f"/goals/{goal['id']}/contributions", headers=other_headers, json={"amount": 1000}).status_code == 404
    assert c.get("/budgets", headers=other_headers).json() == []
    assert c.get("/dashboard", headers=other_headers).json()["free_to_spend"] == 0
