#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

cd "$BACKEND_DIR"

if [[ ! -x ".venv/bin/python3" ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements-dev.txt
fi

cd "$ROOT_DIR"
PYTHONPATH="$ROOT_DIR" "$BACKEND_DIR/.venv/bin/python3" -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload
