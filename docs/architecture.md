# Architecture

## Overview

Operon Intelligence is split into two deployable parts:

- `frontend/`: React 19 + Vite + TypeScript operator console
- `backend/`: FastAPI + SQLite complaint-processing API

In production, the backend can also serve the built frontend bundle from `frontend/dist`, so the simplest deployment shape is a single FastAPI process plus one SQLite database file.

## Runtime flow

1. Complaint intake arrives from phone, email, AI chat, forms, manual operator submission, normalized batch uploads, or scheduled CFPB ingestion.
2. All complaint records are normalized into one canonical complaint shape.
3. The complaint is analyzed through the deterministic local pipeline, with optional DeepSeek classification acceleration when a key is configured.
4. Company-facing enrichment attaches:
   - customer dossier
   - internal team ownership and handoffs
   - baseline workflow comparison
   - criticality scoring
   - supervisor review-gate decisions
   - deterministic ticket metadata and timeline
5. The frontend consumes those enriched contracts across Dashboard, Explorer, Analyze, Complaints, Audit Trail, Supervisor, Triage, and Look-up.

## Key backend modules

- `backend/main.py`
  - API routes
  - startup lifecycle
  - scheduler loop
  - static frontend serving in production
- `backend/database.py`
  - SQLite connection helpers
  - complaint and schedule persistence
  - analysis and audit retrieval
- `backend/services/local_pipeline.py`
  - deterministic classification, compliance, routing, resolution, and QA
- `backend/services/company_logic.py`
  - customer dossier
  - internal team flow
  - baseline workflow
  - criticality and review gate
  - summary/detail enrichment
- `backend/services/ticketing.py`
  - deterministic ticket id creation
  - ticket status/stage derivation
  - end-to-end ticket timeline
- `backend/services/lookup.py`
  - customer/ticket lookup list
  - full customer history response
- `backend/services/intake.py`
  - ingestion preview
  - normalization helpers for sparse CSV/JSON/API payloads

## Key frontend modules

- `frontend/src/App.tsx`
  - lazy-loaded route map
- `frontend/src/store/index.ts`
  - shared domain types and Zustand app state
- `frontend/src/services/api.ts`
  - typed API client
- `frontend/src/hooks/useBackendData.ts`
  - polling for stats, trends, complaints, and sample data
- `frontend/src/hooks/useSyntheticFeed.ts`
  - synthetic fallback population and periodic refresh
- `frontend/src/utils/lookup.ts`
  - customer lookup fallback shaping and filtering
- `frontend/src/pages/*`
  - operator workflows and dashboard routes

## Data model highlights

### Complaint

The complaint is the canonical unit of intake and analysis. Every operator page ultimately reads complaint detail or complaint summary contracts.

### Customer

Customers are modeled as enriched dossiers attached to complaint detail. If an upstream source does not provide a customer id, Operon derives a deterministic stable customer id so history, look-up, and internal-team pages still work.

### Ticket

Each complaint gets exactly one deterministic ticket id. Ticket state includes:

- `ticket_id`
- `status`
- `stage`
- `owner_team`
- `queue`
- `priority`
- `sla_hours`
- `due_at`
- `history[]`

### Schedule

Schedules are persisted in SQLite and support:

- one-time or manual runs
- recurring 4-hour CFPB ingestion
- run history and recovery after restarts

## Deployment shape

### Development

- Vite frontend at `http://localhost:5173`
- FastAPI backend at `http://localhost:8000`

### Production

- Build frontend with `./scripts/build.sh`
- Run backend with `./scripts/run-prod.sh`
- Backend serves API routes and built frontend bundle together

## Test strategy

- Backend unit tests cover deterministic ticket behavior
- Backend integration tests cover complaints, lookup, tickets, and schedules
- Frontend unit tests cover customer-lookup shaping and filtering
