"""MVP 0 smoke test — also the written form of the milestone's exit criteria.

Run with:  pytest -q backend/tests
Requires:  pip install pytest httpx
"""
import os
import tempfile

os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.gettempdir()}/gullak_test.db")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


def _signup(c, email, name):
    r = c.post("/auth/signup", json={"email": email, "password": "password123", "name": name})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_tenant_isolation_and_ledger():
    with TestClient(app) as c:
        assert c.get("/healthz").json() == {"ok": True}

        asha = _signup(c, "asha@example.com", "Asha Rao")
        bilal = _signup(c, "bilal@example.com", "Bilal Khan")

        account = c.post(
            "/accounts", headers=asha,
            json={"name": "HDFC Savings", "type": "bank", "opening_balance": 4_250_000},
        ).json()
        leaf = next(x for x in c.get("/categories", headers=asha).json() if x["parent_id"])

        tx = c.post(
            "/transactions", headers=asha,
            json={
                "account_id": account["id"], "amount": 32_000, "occurred_at": "2026-11-10",
                "merchant": "Swiggy", "category_id": leaf["id"],
            },
        )
        assert tx.status_code == 201
        tx_id = tx.json()["id"]

        assert c.get("/accounts", headers=asha).json()[0]["balance"] == 4_250_000 - 32_000
        assert c.get("/transactions/summary", headers=asha).json()["spent"] == 32_000

        # a second household sees nothing, and cannot reach across
        assert c.get("/transactions", headers=bilal).json() == []
        assert c.get("/accounts", headers=bilal).json() == []
        assert c.patch(f"/transactions/{tx_id}?category_id={leaf['id']}", headers=bilal).status_code == 404
        assert c.post(
            "/transactions", headers=bilal,
            json={"account_id": account["id"], "amount": 100, "occurred_at": "2026-11-10", "merchant": "X"},
        ).status_code == 404

        assert c.get("/transactions").status_code == 401

        created = c.post("/demo/seed", headers=asha).json()["created"]
        assert created > 200
        assert len(c.get("/transactions?limit=500", headers=asha).json()) >= created
        assert c.get("/transactions", headers=bilal).json() == []
