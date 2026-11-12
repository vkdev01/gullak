"""MVP 0 exit criteria: the ledger adds up, and households cannot see each other."""

def test_health(client):
    assert client.get("/healthz").json() == {"ok": True}


def test_tenant_isolation_and_ledger(household):
    c, asha, account_id = household

    bilal = c.post(
        "/auth/signup",
        json={"email": "bilal@example.com", "password": "password123", "name": "Bilal Khan"},
    ).json()
    bilal = {"Authorization": f"Bearer {bilal['access_token']}"}

    leaf = next(x for x in c.get("/categories", headers=asha).json() if x["parent_id"])
    before = c.get("/accounts", headers=asha).json()[0]["balance"]

    tx = c.post(
        "/transactions",
        headers=asha,
        json={
            "account_id": account_id,
            "amount": 32_000,
            "occurred_at": "2026-11-10",
            "merchant": "Swiggy",
            "category_id": leaf["id"],
        },
    )
    assert tx.status_code == 201
    tx_id = tx.json()["id"]

    # a debit reduces the balance by exactly the amount
    assert c.get("/accounts", headers=asha).json()[0]["balance"] == before - 32_000
    assert c.get("/transactions/summary", headers=asha).json()["spent"] >= 32_000

    # a second household sees nothing, and cannot reach across
    assert c.get("/transactions", headers=bilal).json() == []
    assert c.get("/accounts", headers=bilal).json() == []
    assert c.patch(f"/transactions/{tx_id}?category_id={leaf['id']}", headers=bilal).status_code == 404
    assert c.post(
        "/transactions",
        headers=bilal,
        json={"account_id": account_id, "amount": 100, "occurred_at": "2026-11-10", "merchant": "X"},
    ).status_code == 404

    assert c.get("/transactions").status_code == 401


def test_demo_seed_stays_inside_the_household(household):
    c, asha, _ = household
    bilal = c.post(
        "/auth/signup",
        json={"email": "bilal@example.com", "password": "password123", "name": "Bilal Khan"},
    ).json()
    bilal = {"Authorization": f"Bearer {bilal['access_token']}"}

    created = c.post("/demo/seed", headers=asha).json()["created"]
    assert created > 200
    assert len(c.get("/transactions?limit=500", headers=asha).json()) >= created
    assert c.get("/transactions", headers=bilal).json() == []
