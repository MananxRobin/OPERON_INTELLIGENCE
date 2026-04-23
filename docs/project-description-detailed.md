# Operon Intelligence: Detailed Project Description

## 1. What this project is

Operon Intelligence is a complaint-operations platform built for banks, fintechs, lenders, and internal operations teams that need to intake, analyze, prioritize, route, and track consumer complaints in one system.

At its core, the project turns a raw complaint narrative into an operational record that is easier for a company to act on. It does this by combining:

- multi-channel complaint intake
- normalization into a common complaint shape
- deterministic analysis logic
- optional LLM-assisted acceleration through DeepSeek
- internal routing and compliance framing
- customer and ticket enrichment
- operator-facing dashboards and workflow screens
- schedule-based ingestion and run history

The system is intentionally designed to remain useful even when external AI services or live upstream feeds are unavailable. That is a major theme of the codebase.

## 2. Why this project exists

Complaint handling is usually fragmented across channels, teams, and systems. A bank or fintech might receive complaints from:

- web forms
- support calls
- email
- AI chat
- internal operators
- normalized uploaded files
- external regulatory sources such as CFPB complaint data

Those inputs tend to arrive in different formats, with inconsistent fields, unclear urgency, and limited operational context. That creates several business problems:

- teams spend time re-reading and re-classifying the same complaint manually
- compliance-sensitive cases can be missed or escalated too late
- ownership is not obvious across fraud, servicing, card, lending, or compliance teams
- dashboards and customer history are incomplete because data is spread across systems
- executives and supervisors do not get a clean view of backlog, risk, and operational drift

Operon addresses those problems by providing a single complaint workflow with deterministic outputs and a clear operator UI.

## 3. Product philosophy

This repository is not just a demo dashboard. It is structured like an operations product with a practical bias toward reliability and explainability.

The design principles visible in the code are:

- deterministic first: core behavior should work without an LLM
- optional AI acceleration: DeepSeek can improve parts of the flow, but it is not required for the platform to function
- explainable outputs: routing, compliance exposure, ticketing, and review decisions are surfaced in human-readable form
- operator usefulness over model novelty: the frontend is built around queues, lookups, trends, and audit trails
- local-first deployability: the stack can run on a single machine with SQLite and one FastAPI process
- production-hardening mindset: schedules, run history, startup recovery, and frontend serving are already considered

## 4. High-level product story

A complaint enters the platform.

The system normalizes it into a canonical structure.

That complaint is then analyzed through a pipeline that determines:

- what product the complaint concerns
- what issue category it belongs to
- how severe it appears
- which regulations may be implicated
- how much risk the case carries
- which internal team should own it
- what resolution path makes sense
- whether QA or supervisor review is needed

After that, the system enriches the case with company-facing context:

- deterministic ticket metadata
- internal queue and team ownership
- customer profile and account context
- baseline workflow comparison
- criticality scoring
- review-gate decisions
- dashboard-friendly summaries

The frontend then exposes that information across multiple operational views so different users can work from the same underlying complaint contract.

## 5. Who this is for

The project is built for internal operators rather than consumers.

Representative user groups include:

- operations analysts reviewing incoming complaint volume
- triage teams assigning complaints to the right queue
- supervisors monitoring high-risk or SLA-risk work
- compliance and regulatory teams reviewing sensitive narratives
- executive-response teams handling CFPB-originated or regulator-sensitive issues
- internal support teams looking up a customer, ticket, or complaint history

## 6. Main capabilities

The current repository supports the following major capabilities:

- unified complaint intake from multiple sources
- canonical complaint normalization
- deterministic complaint analysis
- optional DeepSeek-assisted classification
- regulatory and compliance risk estimation
- internal team routing
- deterministic ticket generation and timeline shaping
- customer dossier generation
- dashboard statistics and trends
- live and synthetic data support
- customer and ticket lookup
- schedule-driven CFPB ingestion
- run history and restart recovery
- audit trail visibility
- single-process local production deployment

## 7. Architecture overview

The project has two primary deployable parts:

- `frontend/`: React 19, TypeScript, Vite, Zustand, Recharts
- `backend/`: FastAPI, Python, SQLite

In development, they run as separate servers:

- frontend at `http://localhost:5173`
- backend at `http://localhost:8000`

In production-style local mode, the backend can serve the built frontend bundle from `frontend/dist`. That means the simplest runtime shape is:

- one FastAPI process
- one SQLite database file
- one built React bundle

This is a deliberate simplification that makes the project easy to run locally and easy to evolve toward Docker or a more formal deployment later.

## 8. Backend responsibilities

The backend is the operational core of the platform. It is responsible for:

- accepting and serving complaint data
- normalizing intake payloads
- running the deterministic analysis pipeline
- optionally invoking DeepSeek for faster or richer classification
- persisting complaints, analysis results, audits, schedules, and run history
- enriching complaint details into frontend-friendly contracts
- exposing API endpoints for dashboards, lookup, schedules, and analysis
- running a scheduler loop for recurring ingestion
- serving the built frontend bundle in production mode

### Important backend modules

`backend/main.py`

- initializes environment and FastAPI
- wires API routes
- owns startup and shutdown behavior
- manages scheduler lifecycle
- handles live analysis flows
- exposes static frontend serving behavior in production

`backend/database.py`

- creates and manages SQLite persistence
- stores complaint records
- stores analysis results
- stores audit logs
- stores schedules and schedule runs
- supports query helpers used by API endpoints

`backend/services/local_pipeline.py`

- provides deterministic complaint classification
- computes compliance exposure
- computes routing outcomes
- builds resolution guidance
- builds QA outputs
- creates audit entries
- provides a fully local fallback path

`backend/services/company_logic.py`

- creates customer dossiers
- derives customer IDs when not provided upstream
- constructs internal team context
- builds baseline workflows
- computes criticality and review outcomes
- shapes dashboard stats and summary/detail contracts

`backend/services/ticketing.py`

- creates deterministic ticket IDs
- shapes ticket status, stage, owner, queue, SLA, due date, and timeline

`backend/services/lookup.py`

- builds list-style lookup records
- assembles customer-centric history responses
- exposes complaint, ticket, and timeline context in a lookup-oriented format

`backend/services/intake.py`

- previews normalized input
- transforms sparse or inconsistent rows into the canonical complaint format

`backend/agents/`

- contains the orchestrated agent-style flow used for richer analysis behavior
- complements the deterministic local pipeline
- supports streaming or staged feedback patterns in the product

## 9. Frontend responsibilities

The frontend is the operator console. Its job is not only to display complaint data, but to make the product feel like a real workflow system.

The frontend is responsible for:

- navigation across operational workspaces
- dashboard display and trend visualization
- complaint queue review
- manual complaint analysis submission
- customer and ticket lookup
- supervisor and high-risk queue handling
- audit and explainability display
- fallback behavior when synthetic data is needed
- dark/light theme presentation

### Important frontend modules

`frontend/src/App.tsx`

- defines the lazy-loaded route map

`frontend/src/store/index.ts`

- contains shared domain types and centralized Zustand state

`frontend/src/services/api.ts`

- provides typed client-side access to backend endpoints

`frontend/src/hooks/useBackendData.ts`

- handles polling and retrieval for operational views such as stats, trends, and complaints

`frontend/src/hooks/useSyntheticFeed.ts`

- keeps the application usable when live data is absent or intentionally simulated

`frontend/src/utils/lookup.ts`

- shapes and filters customer lookup records for the UI

`frontend/src/pages/*`

- contains the main workflow screens used by internal operators

## 10. Frontend product surfaces

The route map reflects the intended operator use cases.

### Overview area

`Synopsis`

- executive KPI cards
- complaint volume trends
- criticality composition
- AI versus baseline divergence summary
- supervisor queue snapshot
- CFPB pulse and institution exposure views

`Live Feed`

- near-real-time or synthetic complaint feed
- schedule controls
- run history visibility

`Explorer`

- intake source views
- normalized dataset preview
- batch triage context

`Analysis`

- macro-level risk and escalation views
- internal team flow
- customer dossier slices

`Enforcement Radar`

- enforcement concentration and institution exposure monitoring

`Institution Monitor`

- institution-level complaint and risk tracking

### Agent area

`Analyze`

- manual complaint submission
- normalization preview
- streaming analysis feedback

`Triage`

- queue filtering
- complaint drill-in

`Supervisor`

- human review queue
- high-risk queue
- SLA-risk queue

`Look-up`

- customer dossier
- complaint history
- ticket timeline
- account and credit context

`Complaints`

- narrative evidence display
- AI versus baseline comparison
- routing rationale
- ticket record and timeline
- customer and internal team context

`Audit Trail`

- step-by-step analysis trace
- evidence spans
- review-gate and baseline explanation

## 11. Core runtime flow

The runtime flow of the system is one of the most important things to understand.

### Step 1: Complaint intake

A complaint can originate from multiple channels or ingestion paths. The platform treats those as sources feeding into a shared complaint model.

### Step 2: Normalization

The input is converted into one canonical complaint shape. This is critical because downstream analysis, dashboards, lookup, and ticketing all depend on stable fields.

### Step 3: Classification

The system determines:

- product
- sub-product
- issue
- sub-issue
- severity
- urgency
- confidence
- key entities

The default implementation is deterministic and rule-based. If a DeepSeek key is configured, classification may be accelerated through an LLM-assisted path, with local fallback on timeout or failure.

### Step 4: Compliance assessment

The complaint is checked against regulation-oriented heuristics. The local pipeline looks for signals connected to frameworks such as:

- TILA / Regulation Z
- Regulation E
- FCRA
- ECOA / Regulation B
- FDCPA
- RESPA / Regulation X
- SCRA
- UDAAP

The result includes:

- flags
- applicable regulations
- risk score
- risk level
- escalation requirement
- reasoning text

### Step 5: Internal routing

The system maps the complaint to a likely owner team, such as:

- Executive Response Team
- Fraud Investigation Team
- Identity & Access Support Team
- Card Operations Team
- Card Disputes Team
- Mortgage Servicing Team
- Student Lending Team
- Lending Operations Team
- Collections Compliance Team
- Retail Banking Operations Team

This routing is deterministic and explainable. It is based on complaint product, issue, channel, and risk signals.

### Step 6: Resolution and QA shaping

The system builds a resolution path and QA outcome so the case is more than a classification artifact. It becomes an operational object.

### Step 7: Persistence

The complaint, analysis result, and audit entries are stored in SQLite. Complaint status moves through stages such as processing and analyzed.

### Step 8: Enrichment

The company-facing enrichment layer adds:

- deterministic ticket record
- customer profile
- internal team details
- baseline workflow
- criticality score
- review-gate decisions
- summary-friendly display fields

### Step 9: Frontend consumption

The frontend reads the enriched contracts and uses them to populate pages, charts, queue tables, and lookup views.

## 12. Deterministic analysis pipeline

One of the strongest ideas in this codebase is that the project remains functional without live AI.

The deterministic local pipeline in `backend/services/local_pipeline.py` uses:

- product keyword rules
- issue keyword rules
- amount extraction
- urgency cues
- protected-population tags
- compliance markers
- routing rules

This means the app can:

- run offline
- support demos reliably
- generate stable outputs for testing
- avoid hard dependence on third-party model availability

That matters for both development velocity and operational trust.

## 13. Optional DeepSeek acceleration

The project supports an optional DeepSeek backend when `DEEPSEEK_API_KEY` is configured.

The LLM-backed behavior is not treated as the only source of truth. Instead, the architecture treats it as a selective accelerator or enhancer. If the LLM path fails, times out, or is not configured, the project falls back to deterministic logic.

This is a practical design choice for a complaints platform because:

- uptime matters more than novelty
- reproducibility matters for testing
- operators still need a result during outages
- governance and explainability benefit from rule-based fallback behavior

## 14. Company-facing enrichment layer

The enrichment layer in `backend/services/company_logic.py` is what makes this repository feel like a complaint-operations product instead of a text classifier.

It adds operational meaning on top of raw analysis.

### Customer profile generation

The system derives a stable customer ID if one is missing. This allows customer-centric lookup and history even when upstream data is incomplete.

It also builds a dossier containing fields such as:

- customer ID
- full name
- segment
- service tier
- credit score
- delinquency days
- default probability
- previous complaints count
- open products
- balances
- hardship indicators
- fraud watch status
- preferred channel

This is synthetic but deterministic enough to keep operator workflows coherent.

### Baseline workflow

The baseline workflow represents how a case would be handled using rule-based operational logic. It includes:

- assigned team
- assigned tier
- priority
- SLA hours
- review outcome
- factors and reasoning

This is useful for:

- comparing AI-assisted outputs with baseline assumptions
- detecting divergence
- making the system more explainable to supervisors

### Criticality and review logic

The enrichment layer also turns raw risk into workflow-ready decisions. That includes review gates, team handoff framing, and queue prioritization.

## 15. Ticketing model

Each complaint gets exactly one deterministic ticket ID. This is a strong product choice because it keeps complaint handling traceable and stable.

The ticket concept includes:

- `ticket_id`
- status
- stage
- owner team
- queue
- priority
- SLA hours
- due date
- timeline history

This makes the complaint actionable in an operations setting rather than remaining just a classification record.

## 16. Lookup model

The lookup layer is built around the operational reality that support and compliance teams often think in terms of customer history rather than isolated complaint rows.

`backend/services/lookup.py` supports:

- list-style lookup records
- search by customer, complaint, ticket, product, issue, team, or state
- customer-centric history pages
- complaint and ticket aggregation
- timeline consolidation

This is one of the features that gives the product depth, because it connects a complaint to the broader customer story.

## 17. Scheduler and recurring ingestion

The application includes a persisted scheduling system in SQLite.

The default example is the recurring CFPB ingest that runs every four hours.

The scheduling system supports:

- persisted schedule definitions
- run history
- run status tracking
- restart recovery
- optional startup ingest
- safe disabling through environment flags

This matters because complaint platforms are not only request/response applications. They also need ongoing ingestion behavior and operational continuity.

## 18. Persistence model

SQLite is the storage layer in the current implementation.

The database stores:

- complaints
- analysis results
- audit logs
- schedules
- schedule runs

SQLite is a reasonable choice here because:

- it keeps local development simple
- it lowers setup cost
- it works well for demo and small production-style deployments
- it aligns with the single-process deployment story

The codebase is clearly structured so a future migration to a heavier database would be possible, but simplicity is preferred for now.

## 19. Auditability and explainability

A complaint platform dealing with risk and compliance cannot be a black box.

This repository addresses that by preserving:

- audit trail entries
- evidence spans
- reasoning summaries
- decision outputs by stage
- AI versus baseline comparison surfaces

This is reflected directly in the UI through the `Complaints` and `Audit Trail` views.

The goal is not only to produce answers, but to let operators understand why the system produced them.

## 20. Synthetic data strategy

The project intentionally keeps synthetic and deterministic data paths alive.

That makes the application resilient in situations where:

- external complaint sources are unavailable
- the LLM provider is unavailable
- a demo environment has no live integrations
- developers need stable local behavior for tests and screenshots

This is an important architectural strength of the repository.

## 21. API surface

The backend exposes API endpoints for health checks, complaint access, analysis, schedules, dashboards, and lookup.

Examples include:

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

These APIs provide both operational data and product-specific views that are already shaped for the frontend.

## 22. Development model

The repository is optimized for quick local setup.

### Bootstrap

`./scripts/bootstrap.sh`

This script:

- creates frontend and backend env files if missing
- installs frontend dependencies
- creates the backend virtual environment
- installs backend runtime and test dependencies

### Development servers

`./scripts/dev-frontend.sh`

- starts the Vite frontend

`./scripts/dev-backend.sh`

- starts the FastAPI backend with reload enabled

### Production-style local flow

`./scripts/test.sh`

- runs backend and frontend tests

`./scripts/build.sh`

- validates backend Python modules
- builds the frontend bundle

`./scripts/run-prod.sh`

- serves API routes and built frontend together through FastAPI

## 23. Environment model

The backend uses environment variables such as:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `OPERON_DB_PATH`
- `OPERON_CORS_ORIGINS`
- `OPERON_DISABLE_SCHEDULER`
- `OPERON_ENABLE_STARTUP_INGEST`

The frontend uses:

- `VITE_DEEPSEEK_API_KEY`

The project is careful about startup behavior. In particular, startup ingest is opt-in so the application can boot healthy before launching potentially expensive or network-backed jobs.

## 24. Testing strategy

The test strategy is designed to validate the deterministic parts of the platform.

Backend tests cover:

- deterministic ticket behavior
- complaint detail contracts
- lookup API outputs
- schedule defaults

Frontend tests cover:

- lookup record shaping
- search filtering
- grouped customer history shaping

The tests are intentionally focused on stable domain logic rather than broad browser-level rendering. That matches the repository's emphasis on deterministic workflow correctness.

## 25. Why the architecture makes sense

The architecture works well for this kind of project because it balances realism and practicality.

### Why React + Vite on the frontend

- fast local development
- easy route-based UI expansion
- strong TypeScript ergonomics
- sufficient charting and state management with light dependencies

### Why FastAPI on the backend

- straightforward API development
- good async support
- clean integration with background tasks and streaming responses
- easy local serving of both APIs and built assets

### Why SQLite for now

- near-zero operational setup
- good fit for local and compact deployments
- easy test isolation
- acceptable for the current scale and workflow

### Why deterministic plus optional AI

- prevents hard dependency on vendor uptime
- improves trust and testability
- still allows richer model-assisted behavior where available

### Why operator-first UI pages

- complaint operations is a workflow problem, not just a model inference problem
- operators need queues, dashboards, history, and rationale, not only labels

## 26. Limitations and current boundaries

The repository is already substantial, but it is also honest about its current shape.

Current boundaries include:

- SQLite rather than a larger shared database
- limited test coverage around full UI rendering
- deterministic synthetic enrichment rather than integration with real internal customer systems
- local production-style deployment rather than a fully containerized or cloud-native release
- a focused set of frontend screens rather than every possible operator workflow

These are not necessarily weaknesses. Many of them are conscious tradeoffs to keep the system understandable, runnable, and demonstrable.

## 27. What makes this project interesting

Several aspects make Operon more than a standard CRUD dashboard or LLM wrapper:

- it treats complaints as operational cases rather than plain text inputs
- it combines deterministic logic with optional AI instead of requiring AI
- it builds customer, ticket, team, and workflow context around every complaint
- it exposes explanation surfaces instead of hiding decisions
- it already includes scheduling, run history, and recovery concepts
- it can run in a compact local deployment shape

That combination gives the codebase a clear product identity.

## 28. In one sentence

Operon Intelligence is a locally deployable complaint-operations system that ingests complaints from multiple sources, normalizes and analyzes them through deterministic and optionally AI-assisted workflows, enriches them into actionable customer and ticket records, and exposes the full operational picture through an internal dashboard and review console.

## 29. Short conclusion

If you want to understand this repository at a high level, the most important thing to remember is this:

Operon is designed to turn messy inbound complaint text into structured, explainable, operational work.

Everything in the project supports that goal:

- the intake flows
- the deterministic analysis
- the optional LLM layer
- the enrichment logic
- the tickets and customer dossier
- the dashboards and queue pages
- the scheduler and run history
- the local deployment model

It is a practical system for making complaint handling more consistent, visible, and operationally actionable.
