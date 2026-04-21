#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/bootstrap.sh"
"$ROOT_DIR/scripts/test.sh"
"$ROOT_DIR/scripts/build.sh"

cat <<EOF

Deployment bundle is ready.

To run the production app locally:
  ./scripts/run-prod.sh

The FastAPI server will expose:
  - API endpoints under /api/*
  - the built frontend from frontend/dist for all non-API routes
EOF
