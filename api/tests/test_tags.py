"""Notes and tags: the context a person adds so a row explains itself later."""

from datetime import date


def _account(c, headers):
    return c.post("/accounts", headers=headers, json={"name": "Wallet", "type": "cash"}).json()["id"]


def test_tags_are_normalised_and_round_trip(household):
    c, headers, _ = household
    account_id = _account(c, headers)
    created = c.post(
        "/transactions",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": 45_000,
            "occurred_at": date.today().isoformat(),
            "merchant": "Petrol pump",
            "note": "Full tank before the Goa drive",
            "tags": ["#Car", "road trip", "car", ""],
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["tags"] == ["car", "road-trip"]
    assert c.get(f"/transactions/{body['id']}", headers=headers).json()["tags"] == ["car", "road-trip"]


def test_patch_describes_and_tags_a_row(household):
    c, headers, _ = household
    account_id = _account(c, headers)
    row = c.post(
        "/transactions",
        headers=headers,
        json={"account_id": account_id, "amount": 1_000, "occurred_at": date.today().isoformat(), "merchant": "Misc"},
    ).json()

    patched = c.patch(f"/transactions/{row['id']}", headers=headers, json={"note": " gift for mum ", "tags": ["family"]})
    assert patched.status_code == 200
    assert patched.json()["note"] == "gift for mum"
    assert patched.json()["tags"] == ["family"]

    # the older query-string form still recategorises
    dining = next(x for x in c.get("/categories", headers=headers).json() if x["name"] == "Dining")
    again = c.patch(f"/transactions/{row['id']}?category_id={dining['id']}", headers=headers)
    assert again.json()["category_id"] == dining["id"]
    assert again.json()["tags"] == ["family"]


def test_tag_filter_and_search_read_notes_and_tags(household):
    c, headers, _ = household
    account_id = _account(c, headers)
    today = date.today().isoformat()
    for merchant, note, tags in [
        ("Shell", "fuel for the trip", ["car", "trip"]),
        ("Swiggy", "", ["food"]),
        ("Cash", "parking at the airport", ["car-park"]),
    ]:
        c.post(
            "/transactions",
            headers=headers,
            json={"account_id": account_id, "amount": 10_000, "occurred_at": today, "merchant": merchant, "note": note, "tags": tags},
        )

    by_tag = c.get("/transactions", headers=headers, params={"tag": "car"}).json()
    assert [r["merchant"] for r in by_tag] == ["Shell"]  # "car-park" is a different tag
    assert c.get("/transactions/count", headers=headers, params={"tag": "car"}).json()["count"] == 1

    by_note = c.get("/transactions", headers=headers, params={"q": "airport"}).json()
    assert [r["merchant"] for r in by_note] == ["Cash"]


def test_a_row_cannot_point_at_another_households_category(household, client):
    c, headers, _ = household
    other = client.post("/auth/signup", json={"email": "z@example.com", "password": "password123", "name": "Z"}).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    foreign = c.get("/categories", headers=other_headers).json()[0]

    account_id = _account(c, headers)
    created = c.post(
        "/transactions",
        headers=headers,
        json={"account_id": account_id, "amount": 1, "occurred_at": date.today().isoformat(), "merchant": "x", "category_id": foreign["id"]},
    )
    assert created.status_code == 404

    assert c.post("/categories", headers=headers, json={"name": "Sneaky", "parent_id": foreign["id"]}).status_code == 404


def test_new_child_category_inherits_its_parent(household):
    c, headers, _ = household
    transport = next(x for x in c.get("/categories", headers=headers).json() if x["name"] == "Transport")
    made = c.post("/categories", headers=headers, json={"name": "Bike EMI", "parent_id": transport["id"], "kind": "income"})
    assert made.status_code == 201
    assert made.json()["kind"] == "expense"
    assert c.post("/categories", headers=headers, json={"name": "bike emi", "parent_id": transport["id"]}).status_code == 409
