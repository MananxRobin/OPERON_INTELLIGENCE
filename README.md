# Operon Intelligence

Operon Intelligence is a complaint-operations platform for banks, fintechs, and lenders. It ingests complaints from multiple channels, normalizes them into one canonical dataset, analyzes them through an agentic workflow, routes them to internal teams, and exposes the full customer/ticket story through an operator dashboard.

The current codebase is designed to support both demo mode and production-style local deployment:

- synthetic data keeps the platform usable without live sources
- scheduled CFPB ingestion runs every 4 hours by default
- every complaint has one deterministic ticket id
- customer history is available through the new `Look-up` workspace
- the backend can serve the built frontend bundle for a simple single-process deployment

## Core capabilities

- Unified complaint intake across phone, email, AI chat, forms, manual entry, normalized uploads, and CFPB ingestion
- Deterministic complaint analysis pipeline with optional DeepSeek acceleration
- Explainable routing, evidence support, baseline comparison, and supervisor review gates
- Internal team handoff model with customer profile and account context
- Customer and ticket lookup for internal operators
- SQLite-backed schedules and run history
- Dark and light themes with the existing Bloomberg-terminal-inspired shell

## Product pages

### Overview

- `Synopsis`
- `Live Feed`
- `Explorer`
- `Analysis`
- `Enforcement Radar`
- `Institution Monitor`

### Agent

- `Analyze`
- `Triage`
- `Supervisor`
- `Look-up`
- `Complaints`
- `Audit Trail`

## Repository structure

```text
Fin/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── agents/
│   ├── data/
│   ├── models/
│   ├── services/
│   │   ├── company_logic.py
│   │   ├── intake.py
│   │   ├── local_pipeline.py
│   │   ├── lookup.py
│   │   └── ticketing.py
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── public/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── store/
│       └── utils/
├── docs/
├── scripts/
├── Makefile
├── LICENSE
└── pytest.ini
```

## Quick start

### 1. Bootstrap everything

```bash
./scripts/bootstrap.sh
```

This will:

- create `frontend/.env` and `backend/.env` if missing
- install frontend dependencies
- create the backend virtualenv
- install backend runtime and test dependencies

### 2. Configure environment variables

#### `frontend/.env`

```env
VITE_DEEPSEEK_API_KEY=sk-your-deepseek-key
```

#### `backend/.env`

```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_MODEL=deepseek-chat
```

Optional backend overrides:

```env
OPERON_DB_PATH=/absolute/path/to/operon.db
OPERON_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
OPERON_DISABLE_SCHEDULER=0
OPERON_ENABLE_STARTUP_INGEST=0
```

Startup ingest is opt-in. The persisted 4-hour CFPB schedule is enabled by default, but the backend does not fire an eager live ingest during boot unless `OPERON_ENABLE_STARTUP_INGEST=1`.

### 3. Start development servers

Frontend:

```bash
./scripts/dev-frontend.sh
```

Backend:

```bash
./scripts/dev-backend.sh
```

Default URLs:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`

## Production-style local run

Build and run the single-serve deployment:

```bash
./scripts/test.sh
./scripts/build.sh
./scripts/run-prod.sh
```

In this mode FastAPI serves:

- `/api/*` for backend endpoints
- the built React bundle for all non-API routes

## Scripts

- `./scripts/bootstrap.sh`
- `./scripts/dev-frontend.sh`
- `./scripts/dev-backend.sh`
- `./scripts/test.sh`
- `./scripts/build.sh`
- `./scripts/run-prod.sh`
- `./scripts/deploy.sh`

Equivalent `make` targets are available:

- `make bootstrap`
- `make install`
- `make dev`
- `make backend`
- `make test`
- `make build`
- `make deploy`

## Test coverage

### Backend

- complaint detail contract
- customer lookup API
- ticket generation
- default schedule presence

### Frontend

- customer lookup shaping
- lookup search filtering
- grouped customer history shaping

Run all tests:

```bash
./scripts/test.sh
```

## API highlights

- `GET /api/health`
- `GET /api/complaints`
- `GET /api/complaints/{complaint_id}`
- `POST /api/complaints/analyze`
- `POST /api/complaints/analyze/sync`
- `GET /api/audit/{complaint_id}`
- `GET /api/dashboard/stats`
- `GET /api/dashboard/trends`
- `GET /api/dashboard/supervisor`
- `GET /api/internal-teams`
- `GET /api/intake/preview`
- `POST /api/normalize/preview`
- `POST /api/normalize/submit`
- `GET /api/schedules`
- `POST /api/schedules`
- `POST /api/schedules/{id}/run`
- `GET /api/lookup`
- `GET /api/lookup/customers/{customer_id}`

## Documentation

- [Architecture](docs/architecture.md)
- [Frontend Reference](docs/frontend.md)
- [Testing](docs/testing.md)
- [Deployment](docs/deployment.md)

## Open-source license

This repository is released under the MIT License. See [LICENSE](LICENSE).
