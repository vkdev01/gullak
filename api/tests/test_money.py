"""Income, savings and investments: money set aside is never spending, and is never lost."""

from datetime import date

from app.services.periods import period_bounds


def _cat(c, headers, name):
    return next(x for x in c.get("/categories", headers=headers).json() if x["name"] == name)


def _tx(c, headers, account_id, amount, merchant, category_id=None, direction="debit", day=None):
    r = c.post(
        "/transactions",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": amount,
            "occurred_at": (day or date.today()).isoformat(),
            "merchant": merchant,
            "category_id": category_id,
            "direction": direction,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _account(c, headers, **body):
    r = c.post("/accounts", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_an_imported_sip_is_invested_not_spent(household):
    c, headers, bank = household
    _tx(c, headers, bank, 10_000_000, "Acme salary", _cat(c, headers, "Salary")["id"], "credit")
    _tx(c, headers, bank, 50_000, "Swiggy", _cat(c, headers, "Dining")["id"])
    _tx(c, headers, bank, 500_000, "ICICI PRU SIP", _cat(c, headers, "Mutual funds / SIP")["id"])

    d = c.get("/dashboard", headers=headers).json()
    assert d["spent"] == 50_000
    assert d["invested"] == 500_000
    assert d["free_to_spend"] == 10_000_000 - 50_000 - 500_000 - d["committed"]

    # the drill-down agrees with both numbers
    window = {"start": d["period_start"], "end": d["period_end"]}
    assert c.get("/transactions/count", headers=headers, params={**window, "flow": "spend"}).json()["out"] == d["spent"]
    invested_rows = c.get("/transactions", headers=headers, params={**window, "flow": "invest"}).json()
    assert [r["merchant"] for r in invested_rows] == ["ICICI PRU SIP"]


def test_moving_money_into_an_rd_is_saving_and_taking_it_out_is_not_income(household):
    c, headers, bank = household
    rd = _account(c, headers, name="SBI RD", type="rd", interest_rate=6.8, monthly_amount=500_000,
                  description="5-year RD for the car", maturity_date="2031-11-01")
    assert rd["kind"] == "investment"

    today = date.today().isoformat()
    c.post("/transfers", headers=headers, json={"from_account_id": bank, "to_account_id": rd["id"], "amount": 200_000, "occurred_at": today})

    d = c.get("/dashboard", headers=headers).json()
    assert d["spent"] == 0
    assert d["income"] == 0
    assert d["invested"] == 200_000
    assert d["savings_due"] == 300_000  # 5,000 planned, 2,000 paid in

    c.post("/transfers", headers=headers, json={"from_account_id": rd["id"], "to_account_id": bank, "amount": 50_000, "occurred_at": today})
    summary = c.get("/money/summary", headers=headers).json()
    now = summary["periods"][0]
    assert now["income"] == 0
    assert now["withdrawn"] == 50_000
    assert now["invested"] == 200_000

    account = next(a for a in c.get("/accounts", headers=headers).json() if a["id"] == rd["id"])
    assert account["balance"] == 150_000
    assert account["contributed_this_period"] == 200_000


def test_epf_contribution_from_payroll_is_invested_not_income(household):
    c, headers, _ = household
    epf = _account(c, headers, name="EPF", type="epf", opening_balance=45_000_000)
    _tx(c, headers, epf["id"], 1_800_000, "EPF employee + employer", direction="credit")

    d = c.get("/dashboard", headers=headers).json()
    assert d["income"] == 0
    assert d["invested"] == 1_800_000


def test_market_value_gain_and_net_worth(household):
    c, headers, bank = household  # bank opens at 1,25,000
    card = _account(c, headers, name="Card", type="credit_card")
    _tx(c, headers, card["id"], 2_000_000, "Croma", _cat(c, headers, "Electronics")["id"])
    mf = _account(c, headers, name="Index fund", type="mutual_fund", opening_balance=10_000_000)

    patched = c.patch(f"/accounts/{mf['id']}", headers=headers, json={"current_value": 11_500_000})
    assert patched.json()["value"] == 11_500_000
    assert patched.json()["gain"] == 1_500_000
    assert patched.json()["value_as_of"] == date.today().isoformat()

    s = c.get("/money/summary", headers=headers).json()
    assert s["liquid"] == 12_500_000
    assert s["investments"] == 11_500_000
    assert s["owed"] == 2_000_000
    assert s["net_worth"] == 12_500_000 + 11_500_000 - 2_000_000


def test_income_by_source_and_savings_rate(household):
    c, headers, bank = household
    _tx(c, headers, bank, 8_000_000, "Acme", _cat(c, headers, "Salary")["id"], "credit")
    _tx(c, headers, bank, 2_000_000, "Client", _cat(c, headers, "Freelance")["id"], "credit")
    _tx(c, headers, bank, 6_000_000, "Landlord", _cat(c, headers, "Rent")["id"])

    s = c.get("/money/summary", headers=headers, params={"periods": 3}).json()
    assert len(s["periods"]) == 3
    now = s["periods"][0]
    start, _ = period_bounds(1, date.today())
    assert now["period_start"] == start.isoformat()
    assert now["income"] == 10_000_000
    assert now["saved"] == 4_000_000
    assert now["savings_rate"] == 40.0
    assert [(g["label"], g["total"]) for g in s["income_by_source"]] == [("Salary", 8_000_000), ("Freelance", 2_000_000)]


def test_unknown_account_types_are_refused(household):
    c, headers, _ = household
    assert c.post("/accounts", headers=headers, json={"name": "x", "type": "crypto-ish"}).status_code == 422


def test_saving_categories_cannot_be_budgeted(household):
    c, headers, _ = household
    ppf = _cat(c, headers, "PPF")
    assert ppf["kind"] == "saving"
    assert c.post("/budgets", headers=headers, json={"category_id": ppf["id"], "amount": 100}).status_code == 422


def test_default_categories_backfill_is_idempotent(household):
    c, headers, _ = household
    before = len(c.get("/categories", headers=headers).json())
    assert len(c.post("/categories/defaults", headers=headers).json()) == before
    assert len(c.post("/categories/defaults", headers=headers).json()) == before
