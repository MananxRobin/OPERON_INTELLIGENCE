# Deployment

## Recommended local production flow

```bash
./scripts/bootstrap.sh
./scripts/test.sh
./scripts/build.sh
./scripts/run-prod.sh
```

The resulting FastAPI process serves:

- API routes under `/api/*`
- the built React app for non-API routes

## Shell scripts

- `scripts/bootstrap.sh`
  - creates env files if missing
  - installs frontend dependencies
  - creates backend virtualenv
  - installs backend runtime and test dependencies
- `scripts/test.sh`
  - runs backend pytest suite
  - runs frontend vitest suite
- `scripts/build.sh`
  - Python compile check for backend modules
  - Vite production build
- `scripts/run-prod.sh`
  - starts FastAPI in production mode
  - serves the already-built frontend bundle
- `scripts/deploy.sh`
  - bootstrap + test + build in one command

## Environment variables

### Backend

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `OPERON_DB_PATH`
- `OPERON_CORS_ORIGINS`
- `OPERON_DISABLE_SCHEDULER`
- `OPERON_ENABLE_STARTUP_INGEST`

### Frontend

- `VITE_DEEPSEEK_API_KEY`

## Production behavior

- CFPB scheduled ingestion is persisted in SQLite.
- Startup ingest is opt-in so the app can boot fast and healthy before running network-backed jobs.
- If live CFPB fetch fails, the backend can still ingest from the deterministic fallback batch.
- The frontend remains usable against synthetic data even if live services are unavailable.

## Future dockerization

The current scripts intentionally keep the runtime shape simple so Docker support can be added later without redesigning the app:

- one backend service
- one SQLite volume
- one built frontend bundle served by FastAPI
