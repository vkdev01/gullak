.DEFAULT_GOAL := help
.PHONY: help setup env api web dev test test-api test-web typecheck build check \
        up down reset-db clean

# The API needs 3.12: newer interpreters lack wheels for some dependencies.
PYTHON      ?= python3.12
VENV        := api/.venv
PY           = $(VENV)/bin/python
API_PORT    ?= 8000
WEB_PORT    ?= 3000
SECRET_KEY  ?= dev-only-change-me

help: ## Show this help
	@echo "gullak: ledger API (FastAPI) + web app (Next.js). Targets:"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  Run on the in-browser demo store: make web WEB_API=   (no API needed)"

setup: $(VENV)/bin/python env ## Install API and web dependencies
	$(PY) -m pip install --quiet --upgrade pip
	$(PY) -m pip install --quiet -r api/requirements-dev.txt
	cd web && npm install
	@echo ""
	@echo "Next:  make dev     # API :$(API_PORT) + web :$(WEB_PORT)"
	@echo "       make check   # everything CI runs"

$(VENV)/bin/python:
	$(PYTHON) -m venv $(VENV)

env: ## Create api/.env and web/.env.local from the examples if missing
	@test -f api/.env || (cp api/.env.example api/.env && echo "wrote api/.env")
	@test -f web/.env.local || (cp web/.env.example web/.env.local && echo "wrote web/.env.local")

# WEB_API controls whether the web app talks to the API or the browser-only demo store.
WEB_API ?= http://localhost:$(API_PORT)

api: ## Run the API with reload (SQLite at api/gullak.db)
	cd api && SECRET_KEY=$(SECRET_KEY) .venv/bin/uvicorn app.main:app --reload --port $(API_PORT)

web: ## Run the web dev server
	cd web && NEXT_PUBLIC_API_URL=$(WEB_API) npm run dev -- --port $(WEB_PORT)

dev: ## Run API and web together (Ctrl-C stops both)
	@$(MAKE) --no-print-directory -j2 api web

test: test-api test-web ## Run every test

test-api: ## API tests (tenant isolation, ledger maths, removal)
	cd api && .venv/bin/pytest -q tests

test-web: typecheck ## Web typecheck + demo-store probe
	cd web && npm run -s check:demo
	@rm -rf web/.probe

typecheck: ## TypeScript, no emit
	cd web && npm run -s typecheck

build: ## Static export to web/out (stop `make web` first: they share .next)
	cd web && npm run build

check: test build ## What CI runs: tests, then the production build

up: ## Full stack in Docker: postgres + api + web
	docker compose up --build

down: ## Stop the Docker stack
	docker compose down

reset-db: ## Delete the local SQLite dev database (asks first)
	@read -p "Delete api/gullak.db and every row in it? [y/N] " a; \
	  if [ "$$a" = "y" ]; then rm -f api/gullak.db && echo "removed"; else echo "kept"; fi

clean: ## Remove build output and caches (keeps node_modules, .venv and the database)
	rm -rf web/.next web/out web/.probe web/tsconfig.tsbuildinfo api/.pytest_cache
	find api -name __pycache__ -type d -prune -exec rm -rf {} +
