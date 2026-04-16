# ═══════════════════════════════════════════════════════════════════
#  Operon Intelligence — Developer Makefile
#  Run `make help` to see available commands.
# ═══════════════════════════════════════════════════════════════════

.PHONY: help install install-frontend install-backend dev frontend backend env clean

# ── Default target ───────────────────────────────────────────────
help:
	@echo ""
	@echo "  Operon Intelligence"
	@echo ""
	@echo "  make install      Install all dependencies (frontend + backend)"
	@echo "  make env          Copy .env.example files to .env (first-time setup)"
	@echo "  make dev          Start frontend dev server  →  http://localhost:5173"
	@echo "  make backend      Start backend API server   →  http://localhost:8000"
	@echo "  make clean        Remove build artifacts and Python cache"
	@echo ""

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
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# ── Run ──────────────────────────────────────────────────────────
dev:
	cd frontend && npm run dev

backend:
	PYTHONPATH=. backend/.venv/bin/python3 -m uvicorn backend.main:app --port 8000 --reload

# ── Clean ────────────────────────────────────────────────────────
clean:
	rm -rf frontend/dist
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
