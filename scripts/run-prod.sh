#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

if [[ ! -d "$ROOT_DIR/frontend/dist" ]]; then
  echo "frontend/dist not found. Run ./scripts/build.sh first." >&2
  exit 1
fi

if [[ ! -x "$BACKEND_DIR/.venv/bin/python3" ]]; then
  echo "Backend virtualenv missing. Run ./scripts/bootstrap.sh first." >&2
  exit 1
fi

cd "$ROOT_DIR"
OPERON_SERVE_FRONTEND=1 PYTHONPATH="$ROOT_DIR" "$BACKEND_DIR/.venv/bin/python3" -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
