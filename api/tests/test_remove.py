"""Mistakes must be undoable: every addition can be taken back, and nothing is left dangling."""

from datetime import date, timedelta

from tests.test_import import STATEMENT


def _cat(c, headers, name):
    return next(x for x in c.get("/categories", headers=headers).json() if x["name"] == name)


def _tx(c, headers, account_id, amount=21_000_00, merchant="Rent", **extra):
    r = c.post(
        "/transactions",
        headers=headers,
        json={"account_id": account_id, "amount": amount, "occurred_at": date.today().isoformat(), "merchant": merchant, **extra},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _ledger(c, headers):
    return c.get("/transactions", headers=headers, params={"limit": 500}).json()


def _balance(c, headers, account_id):
    return next(a for a in c.get("/accounts", headers=headers).json() if a["id"] == account_id)["balance"]


# ------------------------------------------------------------ transactions

def test_a_mistaken_row_can_be_deleted(household):
    c, headers, account_id = household
    start = _balance(c, headers, account_id)
    row = _tx(c, headers, account_id, 500_000, "Oops")
    assert _balance(c, headers, account_id) == start - 500_000

    assert c.delete(f"/transactions/{row['id']}", headers=headers).json() == {"deleted": 1}
    assert _ledger(c, headers) == []
    assert _balance(c, headers, account_id) == start
    assert c.delete(f"/transactions/{row['id']}", headers=headers).status_code == 404


def test_bulk_delete_removes_only_the_chosen_rows(household):
    c, headers, account_id = household
    rows = [_tx(c, headers, account_id, 100 * (i + 1), f"Row{i}") for i in range(4)]
    out = c.post("/transactions/bulk-delete", headers=headers, json={"ids": [rows[0]["id"], rows[2]["id"], "nope"]})
    assert out.json() == {"deleted": 2}
    assert sorted(r["merchant"] for r in _ledger(c, headers)) == ["Row1", "Row3"]
    assert c.post("/transactions/bulk-delete", headers=headers, json={"ids": ["nope"]}).status_code == 404
    assert c.post("/transactions/bulk-delete", headers=headers, json={"ids": []}).status_code == 422


def test_deleting_one_half_of_a_transfer_removes_both(household):
    c, headers, bank = household
    card = c.post("/accounts", headers=headers, json={"name": "Card", "type": "credit_card"}).json()["id"]
    before = (_balance(c, headers, bank), _balance(c, headers, card))
    sent = c.post(
        "/transfers",
        headers=headers,
        json={"from_account_id": bank, "to_account_id": card, "amount": 300_000, "occurred_at": date.today().isoformat()},
    ).json()

    assert c.delete(f"/transactions/{sent['from_transaction_id']}", headers=headers).json() == {"deleted": 2}
    assert _ledger(c, headers) == []
    assert (_balance(c, headers, bank), _balance(c, headers, card)) == before


def test_nobody_can_delete_another_households_row(household, client):
    c, headers, account_id = household
    row = _tx(c, headers, account_id)
    other = client.post("/auth/signup", json={"email": "o@example.com", "password": "password123", "name": "O"}).json()
    theirs = {"Authorization": f"Bearer {other['access_token']}"}
    assert c.delete(f"/transactions/{row['id']}", headers=theirs).status_code == 404
    assert c.post("/transactions/bulk-delete", headers=theirs, json={"ids": [row["id"]]}).status_code == 404
    assert len(_ledger(c, headers)) == 1


def test_deleting_a_row_unlinks_a_goal_contribution(household):
    c, headers, account_id = household
    row = _tx(c, headers, account_id, 100_000, "Top-up")
    goal = c.post("/goals", headers=headers, json={"name": "Trip", "target": 1_000_000}).json()
    from app.db import SessionLocal
    from app.models import GoalContribution

    with SessionLocal() as db:
        db.add(GoalContribution(goal_id=goal["id"], amount=100_000, transaction_id=row["id"]))
        db.commit()
    assert c.delete(f"/transactions/{row['id']}", headers=headers).status_code == 200
    assert c.get("/goals", headers=headers).json()[0]["contributed"] == 100_000  # the savings stay, only the link goes


def test_a_row_can_be_corrected(household):
    c, headers, account_id = household
    row = _tx(c, headers, account_id, 2_100_000, "Rent")
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    fixed = c.patch(
        f"/transactions/{row['id']}", headers=headers, json={"amount": 210_000, "occurred_at": yesterday, "direction": "credit", "merchant": " Refund "}
    ).json()
    assert (fixed["amount"], fixed["occurred_at"], fixed["direction"], fixed["merchant"]) == (210_000, yesterday, "credit", "Refund")
    assert c.patch(f"/transactions/{row['id']}", headers=headers, json={"amount": 0}).status_code == 422
    assert c.patch(f"/transactions/{row['id']}", headers=headers, json={"direction": "sideways"}).status_code == 422


def test_half_a_transfer_cannot_be_edited(household):
    c, headers, bank = household
    card = c.post("/accounts", headers=headers, json={"name": "Card", "type": "credit_card"}).json()["id"]
    sent = c.post(
        "/transfers",
        headers=headers,
        json={"from_account_id": bank, "to_account_id": card, "amount": 1_000, "occurred_at": date.today().isoformat()},
    ).json()
    r = c.patch(f"/transactions/{sent['from_transaction_id']}", headers=headers, json={"amount": 5})
    assert r.status_code == 409


# --------------------------------------------------------------- adding

def test_adding_needs_a_name_and_a_real_direction(household):
    c, headers, account_id = household
    base = {"account_id": account_id, "amount": 100, "occurred_at": date.today().isoformat()}
    assert c.post("/transactions", headers=headers, json={**base, "merchant": ""}).status_code == 422
    assert c.post("/transactions", headers=headers, json={**base, "merchant": "   "}).status_code == 422
    assert c.post("/transactions", headers=headers, json={**base, "merchant": "x", "direction": "up"}).status_code == 422


def test_a_known_merchant_is_filed_and_an_unknown_one_is_not_guessed(household):
    c, headers, account_id = household
    swiggy = _tx(c, headers, account_id, 32_000, "Swiggy")
    assert swiggy["category_name"] == "Dining"
    assert swiggy["needs_review"] is False
    assert _tx(c, headers, account_id, 32_000, "Ramesh")["category_id"] is None
    explicit = _tx(c, headers, account_id, 32_000, "Swiggy", category_id=_cat(c, headers, "Groceries")["id"])
    assert explicit["category_name"] == "Groceries"  # what you chose wins


def test_nothing_can_be_added_to_an_archived_account(household):
    c, headers, account_id = household
    _tx(c, headers, account_id)
    assert c.delete(f"/accounts/{account_id}", headers=headers).json()["result"] == "archived"
    r = c.post(
        "/transactions",
        headers=headers,
        json={"account_id": account_id, "amount": 1, "occurred_at": date.today().isoformat(), "merchant": "x"},
    )
    assert r.status_code == 404


# ---------------------------------------------------------------- imports

def test_an_import_can_be_taken_back_and_redone(household):
    c, headers, account_id = household
    preview = c.post("/imports/preview", headers=headers, json={"account_id": account_id, "filename": "a.csv", "csv": STATEMENT}).json()
    batch = preview["batch"]["id"]
    c.post(f"/imports/{batch}/commit", headers=headers, json={})
    assert len(_ledger(c, headers)) == 10

    assert c.delete(f"/imports/{batch}", headers=headers).json() == {"deleted": 10}
    assert _ledger(c, headers) == []
    assert c.get("/imports", headers=headers).json() == []

    again = c.post("/imports/preview", headers=headers, json={"account_id": account_id, "filename": "a.csv", "csv": STATEMENT}).json()
    assert again["batch"]["duplicate_count"] == 0  # nothing left to collide with
    assert c.post(f"/imports/{again['batch']['id']}/commit", headers=headers, json={}).json()["imported_count"] == 10


def test_a_preview_can_be_discarded(household):
    c, headers, account_id = household
    preview = c.post("/imports/preview", headers=headers, json={"account_id": account_id, "csv": STATEMENT}).json()
    assert c.delete(f"/imports/{preview['batch']['id']}", headers=headers).json() == {"deleted": 0}
    assert c.get(f"/imports/{preview['batch']['id']}", headers=headers).status_code == 404


# ---------------------------------------------------------------- accounts

def test_an_empty_account_is_deleted_and_a_used_one_is_archived(household):
    c, headers, bank = household
    spare = c.post("/accounts", headers=headers, json={"name": "Typo bank", "type": "bank"}).json()["id"]
    assert c.delete(f"/accounts/{spare}", headers=headers).json() == {"result": "deleted", "transactions": 0}
    assert spare not in [a["id"] for a in c.get("/accounts", headers=headers).json()]

    _tx(c, headers, bank)
    out = c.delete(f"/accounts/{bank}", headers=headers).json()
    assert out == {"result": "archived", "transactions": 1}
    assert len(_ledger(c, headers)) == 1  # history is kept


# ------------------------------------------------------------------ goals

def test_a_goal_can_be_deleted_and_the_last_contribution_undone(household):
    c, headers, _ = household
    goal = c.post("/goals", headers=headers, json={"name": "Trip", "target": 1_000_000}).json()
    c.post(f"/goals/{goal['id']}/contributions", headers=headers, json={"amount": 100_000})
    c.post(f"/goals/{goal['id']}/contributions", headers=headers, json={"amount": 500_000})

    undone = c.delete(f"/goals/{goal['id']}/contributions/latest", headers=headers).json()
    assert undone["contributed"] == 100_000  # the 5,000 went, the 1,000 stays
    assert c.delete(f"/goals/{goal['id']}/contributions/latest", headers=headers).status_code == 200
    assert c.delete(f"/goals/{goal['id']}/contributions/latest", headers=headers).status_code == 404

    assert c.delete(f"/goals/{goal['id']}", headers=headers).status_code == 204
    assert c.get("/goals", headers=headers).json() == []
    assert c.delete(f"/goals/{goal['id']}", headers=headers).status_code == 404
