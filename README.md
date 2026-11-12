# Gullak

An AI-agentic savings platform. This repository carries **MVP 0 and MVP 1**: the ledger skeleton,
and the statement import that makes the ledger trustworthy.

**Live demo:** https://vkdev01.github.io/gullak/ — the Next.js app exported as static files and
running entirely in your browser (no server, no signup).

## Layout

```
gullak/
├── web/                    the Next.js app — everything front end lives here
│   ├── src/
│   │   ├── app/            routes only (App Router)
│   │   ├── components/     layout/ · ui/ · ledger/ · import/ · review/ · accounts/ · auth/
│   │   ├── hooks/          data and UI state, one hook per concern
│   │   ├── lib/            api/ (client, demo, types) · format · parse · csv · merchants
│   │   ├── styles/         tokens, mixins, globals
│   │   └── config/         site metadata, navigation
│   ├── next.config.mjs     static export + basePath
│   └── package.json
├── api/                    the FastAPI service
│   ├── app/                main, models, schemas, security, routers/, services/, seed
│   ├── migrations/         001_init · 002_mvp1, including row-level security
│   └── tests/              smoke + import suites = the MVP 0 and MVP 1 exit criteria
├── prototype/              single-file HTML prototype of the same screens
├── docker-compose.yml      postgres + api + web
└── .github/workflows/      pages.yml (deploy) · ci.yml (build + tests)
```

Two rules keep this maintainable: **routes compose, they do not implement** — anything with logic
lives in `components/`, `hooks/` or `lib/`; and **the API is the only thing that touches data** —
the web app renders what it is given.

## Run it

**Static, no backend** (what GitHub Pages serves):

```bash
cd web && npm install && npm run build   # emits web/out
```

With `NEXT_PUBLIC_API_URL` unset, `lib/api` swaps its HTTP transport for `lib/api/demo.ts`, a
localStorage implementation of the same contract, so the exported site works on its own.

**Full stack:**

```bash
docker compose up        # db :5432 · api :8000 · web :3000
```

Or run the halves directly:

```bash
cd api && pip install -r requirements.txt && uvicorn app.main:app --reload
cd web && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## Tests

```bash
cd api && pip install pytest httpx && pytest -q tests     # tenant isolation + ledger maths
cd web && npm run build                                  # typecheck + static export
```

CI runs both on every push and pull request.

## What each milestone proves

**MVP 0 — the ledger you can enter.** Accounts, categories, transactions, quick add.
Exit test: *you can enter a real month in under ten minutes, and a second account can never see the
first household's rows.*

**MVP 1 — the ledger you can trust.** Statement import in two phases, a seed list of Indian
merchants, user rules that beat the heuristics, and a review queue for whatever is left.
Exit test: *re-importing the same statement imports zero rows, at least 90% of rows are
auto-categorised, and the rest can be fixed in bulk.*

Tenant isolation is enforced three times over: the API derives the household from the caller's
membership rather than from the request, every query filters on it, and the migrations enable
row-level security so the database refuses cross-tenant reads even if application code forgets.
Duplicate imports are guarded the same way — the preview flags them, the commit skips them, and a
unique partial index on `(account_id, dedupe_hash)` is the last line of defence.

## Working on this repo

Branch per feature, merge to `main` when the work is done and CI is green:

```bash
git checkout -b feature/statement-import
# …commits…
git push -u origin feature/statement-import
gh pr create --fill          # then merge, or merge locally with --no-ff
```

Commit messages follow `type(scope): summary` — `feat(ledger): …`, `fix(api): …`,
`refactor(web): …`, `docs: …`. One logical change per commit; the body explains why, not what.

## Deploying

Push to `main` → `pages.yml` builds `web/` as a static export with the base path injected by
`actions/configure-pages` and publishes it to Pages. To host elsewhere, run `npm run build` in
`web/` and serve `web/out/`; set `NEXT_PUBLIC_API_URL` at build time to point the app at a live API.

## Deliberately not yet

PDF statements, SMS parsing, transfers as paired legs, splits, attachments, budgets, goals,
insights, and every line of agent code. Those arrive in MVP 2 through MVP 5; the roadmap lives in
the planning documents.
