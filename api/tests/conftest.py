"""Shared fixtures. The database URL is set before the app is imported, so every
test module talks to the same throwaway SQLite file, reset between tests."""

import os
import pathlib
import tempfile

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "gullak_pytest.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def household(client):
    """A signed-up user with one bank account: (client, headers, account_id)."""
    r = client.post(
        "/auth/signup",
        json={"email": "asha@example.com", "password": "password123", "name": "Asha Rao"},
    )
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    account = client.post(
        "/accounts",
        headers=headers,
        json={"name": "HDFC Savings", "type": "bank", "opening_balance": 12_500_000},
    ).json()
    return client, headers, account["id"]
