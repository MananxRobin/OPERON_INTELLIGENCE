#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

export PATH="/opt/homebrew/bin:${PATH}"

if [[ ! -f "$FRONTEND_DIR/.env" ]]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
  echo "Created frontend/.env"
fi

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "Created backend/.env"
fi

cd "$FRONTEND_DIR"
npm install

cd "$BACKEND_DIR"
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt

echo
echo "Bootstrap complete."
echo "Frontend env: $FRONTEND_DIR/.env"
echo "Backend env:  $BACKEND_DIR/.env"
