#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:${PATH}"

cd "$ROOT_DIR"
backend/.venv/bin/pytest -q

cd "$ROOT_DIR/frontend"
npm run test:run
