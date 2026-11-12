# Gullak API — MVP 0

FastAPI + SQLAlchemy 2 + PostgreSQL. All business logic lives here; the web app only renders.

## Run locally

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # or set DATABASE_URL to sqlite:///./gullak.db for a quick run
uvicorn app.main:app --reload --port 8000
```

Docs at http://localhost:8000/docs.

## Production schema

`migrations/001_init.sql` is the canonical Postgres schema. It differs from the models in two
ways that matter: `citext` for case-insensitive email, and **row-level security** on every
tenant table, with the API expected to `SET app.household_id` per request. Apply it with:

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/signup` | creates user + household + default category tree |
| POST | `/auth/login` | returns a bearer token |
| GET | `/me` | profile + household |
| GET/POST | `/accounts` | balance computed from opening balance + transactions |
| GET/POST | `/categories` | two-level tree |
| GET | `/transactions` | filters: account, category, direction, q, start, end, limit, offset |
| POST | `/transactions` | amount in paise |
| PATCH | `/transactions/{id}` | recategorise, note |
| GET | `/transactions/summary` | month to date |
| POST | `/demo/seed` | six months of demo data |
| POST | `/imports/preview` | parse a CSV into candidate rows; nothing is written to the ledger |
| POST | `/imports/{id}/commit` | the only path to the ledger; idempotent per batch |
| GET | `/imports` | import history |
| GET | `/transactions/review` | rows the importer was unsure about, with a suggestion |
| POST | `/transactions/bulk` | assign one category to many rows |
| GET/POST/DELETE | `/rules` | user rules that win over the merchant seed list |

## How a statement becomes ledger rows

```
CSV text ──▶ services/csv_import.build_candidates ──▶ ParsedRow[]
                                 │
                    header detection (HDFC/ICICI/SBI/Axis/Kotak, or by name)
                    tolerant date + amount parsing, dedupe hash per row
                                 ▼
              services/categorise ──▶ (merchant, category, confidence, reason)
                    user rules (1.0) → merchant seed list (0.95) → nothing (0.0)
                                 ▼
        import_rows (preview)  ──commit──▶  transactions
                                 ▲
        confidence < 0.7 ──▶ GET /transactions/review ──▶ POST /transactions/bulk
```

`services/merchants.py` is the seed list — canonical name, category, and the aliases that appear
in real narrations. It is data, not logic: extend it and every import gets better.

Every query filters on `household_id` from the caller's membership. The `accounts` and
`transactions` routes also verify the referenced row belongs to the caller's household, so a
malformed request cannot reach another tenant's data.
