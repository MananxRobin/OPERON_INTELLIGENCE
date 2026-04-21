# ═══════════════════════════════════════════════════════════════════
#  Operon Intelligence — Developer Makefile
#  Run `make help` to see available commands.
# ═══════════════════════════════════════════════════════════════════

.PHONY: help bootstrap install install-frontend install-backend dev frontend backend env test build deploy clean

# ── Default target ───────────────────────────────────────────────
help:
	@echo ""
	@echo "  Operon Intelligence"
	@echo ""
	@echo "  make install      Install all dependencies (frontend + backend)"
	@echo "  make bootstrap    Create env files and install everything"
	@echo "  make env          Copy .env.example files to .env (first-time setup)"
	@echo "  make dev          Start frontend dev server  →  http://localhost:5173"
	@echo "  make backend      Start backend API server   →  http://localhost:8000"
	@echo "  make test         Run backend pytest + frontend vitest"
	@echo "  make build        Build production assets"
	@echo "  make deploy       Bootstrap, test, and build the production bundle"
	@echo "  make clean        Remove build artifacts and Python cache"
	@echo ""

bootstrap:
	./scripts/bootstrap.sh

# ── Environment setup ────────────────────────────────────────────
env:
	@[ -f frontend/.env ] || (cp frontend/.env.example frontend/.env && echo "Created frontend/.env")
	@[ -f backend/.env  ] || (cp backend/.env.example  backend/.env  && echo "Created backend/.env")
	@echo "Edit frontend/.env and backend/.env to add your API keys."

# ── Install ──────────────────────────────────────────────────────
install: install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt

# ── Run ──────────────────────────────────────────────────────────
dev:
	./scripts/dev-frontend.sh

backend:
	./scripts/dev-backend.sh

test:
	./scripts/test.sh

build:
	./scripts/build.sh

deploy:
	./scripts/deploy.sh

# ── Clean ────────────────────────────────────────────────────────
clean:
	rm -rf frontend/dist
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
