"""MVP 1 exit criteria, as tests.

> Re-importing the same statement imports zero rows, >=90% of rows are
> auto-categorised, and a human can fix the rest in bulk.
"""

STATEMENT = """HDFC Bank Statement
Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/11/2026,UPI/SWIGGY/4412/BANGALORE,412.00,,125000.00
02/11/2026,POS 4412 APOLLO PHARMACY,330.50,,124669.50
03/11/2026,UPI/BLINKIT/9981/GURGAON,1240.00,,123429.50
04/11/2026,NEFT CR ACME SOLUTIONS SALARY,,142000.00,265429.50
05/11/2026,UPI/UBER/7712/MUMBAI,268.00,,265161.50
06/11/2026,ACH DR NETFLIX,649.00,,264512.50
07/11/2026,IMPS/RAMESH KUMAR/9931,5000.00,,259512.50
08/11/2026,UPI/THIRD WAVE COFFEE/2210,320.00,,259192.50
09/11/2026,POS 5512 CROMA,18999.00,,240193.50
10/11/2026,NEFT CR RENT REFUND,,15000.00,255193.50
"""


def _preview(client, headers, account_id, text=STATEMENT):
    return client.post(
        "/imports/preview",
        headers=headers,
        json={"account_id": account_id, "filename": "hdfc-nov.csv", "csv": text},
    )


def test_preview_parses_and_categorises(household):
    c, headers, account_id = household
    r = _preview(c, headers, account_id)
    assert r.status_code == 201, r.text
    body = r.json()

    assert body["batch"]["row_count"] == 10
    assert body["batch"]["duplicate_count"] == 0

    rows = body["rows"]
    assert len(rows) == 10
    # the four obvious merchants are categorised from the seed list
    by_desc = {row["description"]: row for row in rows}
    assert by_desc["UPI/SWIGGY/4412/BANGALORE"]["category_name"] == "Dining"
    assert by_desc["POS 4412 APOLLO PHARMACY"]["category_name"] == "Pharmacy"
    assert by_desc["UPI/BLINKIT/9981/GURGAON"]["category_name"] == "Groceries"

    # >= 90% of rows are auto-categorised; the unknown IMPS transfer is not
    confident = [row for row in rows if row["confidence"] >= 0.7]
    assert len(confident) / len(rows) >= 0.9

    unknown = by_desc["IMPS/RAMESH KUMAR/9931"]
    assert unknown["status"] == "review"
    assert unknown["category_id"] is None


def test_commit_then_reimport_imports_nothing(household):
    c, headers, account_id = household

    first = _preview(c, headers, account_id).json()
    commit = c.post(f"/imports/{first['batch']['id']}/commit", headers=headers, json={})
    assert commit.status_code == 200, commit.text
    assert commit.json()["imported_count"] == 10

    assert len(c.get("/transactions", headers=headers).json()) == 10

    # same file again: every row is a duplicate, and committing adds nothing
    second = _preview(c, headers, account_id).json()
    assert second["batch"]["duplicate_count"] == 10
    assert all(row["status"] == "duplicate" for row in second["rows"])

    again = c.post(f"/imports/{second['batch']['id']}/commit", headers=headers, json={})
    assert again.json()["imported_count"] == 0
    assert len(c.get("/transactions", headers=headers).json()) == 10


def test_commit_is_idempotent(household):
    c, headers, account_id = household
    batch_id = _preview(c, headers, account_id).json()["batch"]["id"]

    first = c.post(f"/imports/{batch_id}/commit", headers=headers, json={}).json()
    second = c.post(f"/imports/{batch_id}/commit", headers=headers, json={}).json()

    assert first["imported_count"] == 10
    assert second["imported_count"] == 10  # same batch, not a second import
    assert len(c.get("/transactions", headers=headers).json()) == 10


def test_decisions_skip_and_override(household):
    c, headers, account_id = household
    body = _preview(c, headers, account_id).json()

    groceries = next(
        cat for cat in c.get("/categories", headers=headers).json() if cat["name"] == "Groceries"
    )
    skip_row = next(row for row in body["rows"] if row["description"] == "IMPS/RAMESH KUMAR/9931")
    override_row = next(row for row in body["rows"] if row["description"] == "POS 5512 CROMA")

    decisions = [
        {"row_id": skip_row["id"], "action": "skip"},
        {"row_id": override_row["id"], "action": "import", "category_id": groceries["id"]},
    ]
    result = c.post(f"/imports/{body['batch']['id']}/commit", headers=headers, json={"decisions": decisions}).json()

    assert result["imported_count"] == 9
    rows = c.get("/transactions", headers=headers).json()
    assert len(rows) == 9
    assert not any(r["merchant"].startswith("Ramesh") or "RAMESH" in r["note"] for r in rows)
    assert any(r["category_id"] == groceries["id"] and "CROMA" in r["note"] for r in rows)


def test_review_queue_and_bulk_categorise(household):
    c, headers, account_id = household
    batch_id = _preview(c, headers, account_id).json()["batch"]["id"]
    c.post(f"/imports/{batch_id}/commit", headers=headers, json={})

    review = c.get("/transactions/review", headers=headers).json()
    assert len(review) == 1
    assert "RAMESH" in review[0]["note"]

    fees = next(cat for cat in c.get("/categories", headers=headers).json() if cat["name"] == "Fees")
    bulk = c.post(
        "/transactions/bulk",
        headers=headers,
        json={"ids": [row["id"] for row in review], "category_id": fees["id"]},
    )
    assert bulk.json()["updated"] == 1
    assert c.get("/transactions/review", headers=headers).json() == []


def test_rules_beat_the_seed_list(household):
    c, headers, account_id = household
    fees = next(cat for cat in c.get("/categories", headers=headers).json() if cat["name"] == "Fees")

    created = c.post(
        "/rules",
        headers=headers,
        json={"pattern": "SWIGGY", "category_id": fees["id"], "name": "Swiggy is a fee, apparently"},
    )
    assert created.status_code == 201

    rows = _preview(c, headers, account_id).json()["rows"]
    swiggy = next(row for row in rows if "SWIGGY" in row["description"])
    assert swiggy["category_id"] == fees["id"]
    assert swiggy["confidence"] == 1.0
    assert swiggy["reason"] == "rule"


def test_import_is_scoped_to_the_household(household):
    c, headers, account_id = household
    other = c.post("/auth/signup", json={"email": "bilal@example.com", "password": "password123", "name": "Bilal"}).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    assert _preview(c, other_headers, account_id).status_code == 404
    assert c.get("/imports", headers=other_headers).json() == []
