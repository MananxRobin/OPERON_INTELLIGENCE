# Testing

## Test suites

### Backend

- `backend/tests/test_ticketing.py`
  - deterministic ticket id generation
  - ticket status/timeline shaping
- `backend/tests/test_lookup_api.py`
  - complaint list contract includes ticket and customer data
  - complaint detail returns ticket and customer profile
  - lookup endpoints return customer history and ticket timelines
  - default 4-hour CFPB schedule exists

### Frontend

- `frontend/src/utils/lookup.test.ts`
  - lookup-record generation from summaries
  - search filtering across customer/ticket/issue
  - grouped customer-history shaping

## Commands

Run everything:

```bash
./scripts/test.sh
```

Run backend tests only:

```bash
backend/.venv/bin/pytest -q
```

Run frontend tests only:

```bash
cd frontend
npm run test:run
```

## Notes

- Backend tests run against a temporary SQLite database via `OPERON_DB_PATH`.
- Scheduler startup and auto-ingest are disabled during tests through environment flags.
- Frontend tests use Vitest in Node mode because the current coverage is focused on domain shaping utilities rather than browser rendering.
