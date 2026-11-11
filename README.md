# Gullak

An AI-agentic savings platform. This repository is **MVP 0** — the ledger skeleton: accounts,
categories, transactions and the screens to work with them, before any agent exists.

**Live demo:** https://vkdev01.github.io/gullak/ — the Next.js app exported as static files and
running entirely in your browser (no server, no signup).

![stack](https://img.shields.io/badge/Next.js%2015-App%20Router-black) ![stack](https://img.shields.io/badge/FastAPI-Python%203.12-05998b) ![stack](https://img.shields.io/badge/PostgreSQL-16-336791)

## What is in here

```
.
├── app/               Next.js 15 App Router — ledger, accounts, login
├── components/        Shell (nav) and shared chrome
├── lib/               api client · demo transport · types
├── styles/            Sage design tokens, mixins, globals (SCSS)
├── backend/           FastAPI + SQLAlchemy 2 + Postgres schema, seed and tests
├── prototype/         single-file HTML prototype of the same screens
└── .github/workflows/ Pages deployment (static export)
```

## Two ways to run it

**1. Static, no backend.** This is what GitHub Pages serves. With `NEXT_PUBLIC_API_URL` unset,
`lib/api.ts` swaps its transport for `lib/demo.ts`, a localStorage-backed implementation of the
same contract, so the exported site is fully usable on its own.

```bash
npm install
npm run build      # emits out/ — open out/index.html or serve it
```

**2. With the real backend.**

```bash
docker compose up                     # postgres + api + web
# or
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## The stack, and why

| Layer | Choice | Note |
| --- | --- | --- |
| Web | Next.js 15, App Router, TypeScript | `output: "export"` so it can be hosted anywhere static |
| Styling | SCSS modules + a token layer | `styles/_tokens.scss` is the only place a hex value lives |
| API | Python 3.12, FastAPI, SQLAlchemy 2 | all business logic; the web app only renders |
| Data | PostgreSQL | money as integer paise, row-level security per household |

## The MVP 0 exit test

> You can enter a real month in under ten minutes, and a second account can never see the first
> household's rows.

The second half is enforced three times over: the API derives the household from the caller's
membership rather than the request, every query filters on it, and `backend/migrations/001_init.sql`
enables row-level security so the database refuses cross-tenant reads even if application code
forgets. `backend/tests/test_smoke.py` asserts it.

```bash
cd backend && pip install pytest httpx && pytest -q tests
```

## Deploying

Pushing to `main` runs `.github/workflows/pages.yml`, which builds the static export and publishes
it to GitHub Pages. For a project page the base path is injected automatically by
`actions/configure-pages`, so assets resolve under `/<repo>/`.

To host somewhere else, run `npm run build` and serve `out/`. To point the exported app at a live
API, set `NEXT_PUBLIC_API_URL` at build time.

## Deliberately not in MVP 0

Statement import, budgets, goals, insights, transfers, attachments, and every line of agent code.
Those arrive in MVP 1 through MVP 5; the roadmap lives in the planning documents.
