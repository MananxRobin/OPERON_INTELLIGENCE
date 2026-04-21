#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:${PATH}"

cd "$ROOT_DIR"
python3 -m py_compile backend/main.py backend/database.py backend/services/company_logic.py backend/services/ticketing.py backend/services/lookup.py

cd "$ROOT_DIR/frontend"
npm run build

echo
echo "Build complete."
echo "Frontend bundle: $ROOT_DIR/frontend/dist"
