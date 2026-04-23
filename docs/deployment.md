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

This frontend serving behavior is intended for the production-style run only. During normal development, `./scripts/dev-backend.sh` stays API-only and the UI should be accessed through Vite on `http://localhost:5173`.

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

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `OPERON_DB_PATH`
- `OPERON_CFPB_DB_PATH`
- `OPERON_CORS_ORIGINS`
- `OPERON_DISABLE_SCHEDULER`
- `OPERON_ENABLE_STARTUP_INGEST`
- `OPERON_SERVE_FRONTEND`

### Frontend

- `VITE_DEEPSEEK_API_KEY`

## Production behavior

- CFPB scheduled ingestion is persisted in SQLite.
- Startup ingest is enabled by default so the app can bootstrap a larger live CFPB dataset on first boot.
- If live CFPB fetch fails, the backend can still ingest from the deterministic fallback batch.
- The frontend remains usable against synthetic data even if live services are unavailable.

## Future dockerization

The current scripts intentionally keep the runtime shape simple so Docker support can be added later without redesigning the app:

- one backend service
- two SQLite files persisted on one data volume (`operon.db` and `cfpb_cache.db`)
- one built frontend bundle served by FastAPI
