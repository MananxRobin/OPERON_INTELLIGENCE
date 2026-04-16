# Operon Intelligence

> Bloomberg Terminal-style financial complaint intelligence dashboard — CFPB data, real-time risk scoring, and a 5-agent AI pipeline powered by DeepSeek.

---

## What it does

- **Ingests** consumer financial complaints from the CFPB public API (4M+ records)
- **Classifies** every complaint by risk level: CRITICAL / HIGH / MEDIUM / LOW
- **Visualises** complaint trends, state heatmaps, institution rankings, and enforcement signals
- **Falls back** automatically to a statistically-realistic synthetic pool when the CFPB API is unavailable — charts and KPIs work identically in both modes
- **Processes** individual complaint narratives through a 5-agent DeepSeek pipeline: Classification → Compliance Risk → Routing → Resolution → QA Validation

---

## Project layout

```
Fin/
├── frontend/               React 19 + Vite + TypeScript
│   ├── src/
│   │   ├── pages/          Route-level views (lazy-loaded)
│   │   │   ├── Dashboard.tsx       Synopsis — command centre, default view
│   │   │   ├── LiveFeed.tsx        Real-time CFPB stream + click-to-drawer
│   │   │   ├── Explorer.tsx        Full-dataset search + filter table
│   │   │   ├── Analysis.tsx        Temporal analysis: 1D / 7D / 1M / 3M
│   │   │   ├── EnforcementRadar.tsx
│   │   │   ├── InstitutionMonitor.tsx
│   │   │   ├── Analyze.tsx         Submit complaint → AI pipeline (SSE stream)
│   │   │   ├── Complaints.tsx      Browse AI-processed complaints
│   │   │   ├── AuditTrail.tsx      Agent-by-agent decision log
│   │   │   ├── Supervisor.tsx      Supervisor queue + review gate
│   │   │   ├── Triage.tsx
│   │   │   └── Docs.tsx            Full documentation + glossary
│   │   ├── components/layout/      Sidebar (collapsible nav), Topbar
│   │   ├── hooks/
│   │   │   ├── useCfpbData.ts      CFPB API fetch → auto-fallback to synthetic pool
│   │   │   ├── useSyntheticFeed.ts Seed 360 complaints + 600 CFPB-format on mount
│   │   │   └── useBackendData.ts   Poll backend stats/complaints every 20s
│   │   ├── store/index.ts          Zustand global state (theme, pool, stats)
│   │   ├── data/synthetic.ts       generateCfpbPool(600) — weighted realistic data
│   │   ├── services/
│   │   │   ├── api.ts              Backend API client + fetchCfpbComplaints
│   │   │   └── deepseek.ts         DeepSeek batch generator (proxied via Vite)
│   │   ├── styles/globals.css      CSS design tokens — dark + light themes
│   │   ├── constants.ts            RISK_COLORS, PALETTE (CSS var refs)
│   │   └── App.tsx                 Router + lazy route definitions
│   ├── .env                        Your API keys (gitignored)
│   ├── .env.example                Template — copy to .env
│   ├── vite.config.ts              Dev server + proxy rules
│   └── package.json
│
├── backend/                FastAPI + DeepSeek AI pipeline
│   ├── main.py             All REST + SSE endpoints
│   ├── database.py         SQLite schema (auto-created on first run)
│   ├── agents/
│   │   ├── orchestrator.py         LangGraph pipeline coordinator
│   │   ├── base_agent.py           Shared DeepSeek client + audit logging
│   │   ├── classification_agent.py
│   │   ├── compliance_agent.py
│   │   ├── routing_agent.py
│   │   ├── resolution_agent.py
│   │   └── qa_agent.py
│   ├── models/             Pydantic schemas
│   ├── data/
│   │   └── sample_complaints.py    30 seed complaints for batch demo
│   ├── requirements.txt
│   ├── .env                        Your API keys (gitignored)
│   └── .env.example                Template — copy to .env
│
├── Makefile                make install / make dev / make backend
├── .env.example            Master reference — lists all variables across both services
├── .gitignore
└── README.md
```

---

## Quick start (copy-paste ready)

### Step 1 — Clone and enter the project

```bash
git clone <repo-url> && cd Fin
```

### Step 2 — Set up environment files

```bash
make env
# Creates frontend/.env and backend/.env from the .env.example templates
```

Then open both files and add your key:

**`frontend/.env`**
```env
VITE_DEEPSEEK_API_KEY=sk-your-deepseek-key
```

**`backend/.env`**
```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
```

> Both services use the same DeepSeek key.  
> Get one at https://platform.deepseek.com (free tier available).

### Step 3 — Install dependencies

```bash
make install
# Runs: npm install in frontend/ + python3 -m venv + pip install in backend/
```

### Step 4 — Start the frontend

```bash
make dev
# → http://localhost:5173
```

The dashboard works immediately — no backend required. All CFPB data views populate from the live CFPB API or the synthetic fallback pool.

### Step 5 — Start the backend (enables AI Agent views)

Open a second terminal:

```bash
make backend
# → http://localhost:8000
```

This enables the **Agent** sidebar group: Analyze, Complaints, Audit Trail, Supervisor, Triage.

---

## Environment variables

| File | Variable | Required | Purpose |
|---|---|---|---|
| `frontend/.env` | `VITE_DEEPSEEK_API_KEY` | Recommended | Refreshes synthetic complaint pool every 10 min via DeepSeek |
| `backend/.env` | `DEEPSEEK_API_KEY` | For Agent views | Powers the 5-agent AI analysis pipeline |

Without `VITE_DEEPSEEK_API_KEY`: synthetic pool is static (seeded at startup, 600 complaints).  
Without `DEEPSEEK_API_KEY`: Agent views return errors; all CFPB data views still work.

---

## How data flows

```
Browser
  │
  ├── useCfpbData hook
  │     ├─ 1. Try: GET /api/cfpb?size=250  (Vite proxies → consumerfinance.gov)
  │     └─ 2. Fallback: Zustand syntheticCfpbPool (600 complaints, local)
  │
  ├── useSyntheticFeed hook (runs once on mount)
  │     ├─ Seeds 360 complaints into processedComplaints
  │     ├─ Seeds syntheticCfpbPool with 600 CFPB-format records
  │     └─ Every 10 min: calls DeepSeek via /api/deepseek proxy → adds 50 new entries
  │
  └── useBackendData hook (polls every 20s)
        └─ GET /api/dashboard/stats → populates backend KPI cards if AI pipeline has data

Vite proxy rules:
  /api/cfpb/*      → https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1
  /api/deepseek/*  → https://api.deepseek.com
  /api/*           → http://127.0.0.1:8000  (FastAPI backend)
```

---

## Risk scoring

| Level | Trigger |
|---|---|
| **CRITICAL** | Untimely company response OR consumer disputed the resolution |
| **HIGH** | Closed without relief / still in progress past 15-day SLA |
| **MEDIUM** | Closed with non-monetary relief only |
| **LOW** | Closed with full monetary relief — consumer satisfied |

**Institution Risk Score** = `(critRate × 0.50) + (untimelyRate × 0.30) + (disputeRate × 0.20)`

---

## Backend API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/complaints` | List processed complaints — filterable by product, risk, state |
| POST | `/api/complaints/analyze` | Submit narrative for async AI analysis |
| GET | `/api/complaints/analyze/{id}/stream` | SSE stream of real-time agent progress |
| POST | `/api/complaints/analyze/sync` | Synchronous analysis (waits for result) |
| GET | `/api/complaints/{id}` | Full analysis for one complaint |
| GET | `/api/audit/{id}` | Agent-by-agent audit trail |
| GET | `/api/dashboard/stats` | Aggregate KPIs |
| GET | `/api/dashboard/trends?days=14` | Volume trend data |
| GET | `/api/dashboard/supervisor` | Supervisor queue signals |
| POST | `/api/complaints/batch` | Batch-process sample complaints |

---

## Theming

Toggle dark/light with the **LIGHT / DARK** button in the top bar.  
All colors are CSS custom properties — zero hardcoded hex anywhere in the component tree.

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0A0A0A` | `#f5f1ea` |
| `--primary` | `#F0EDE8` | `#181410` |
| `--accent` | `#E8433A` | `#cf4336` |
| `--success` | `#4CAF50` | `#2c8e49` |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8 |
| State | Zustand v5 |
| Routing | React Router v7 (lazy-loaded routes) |
| Charts | Recharts v3 |
| Styling | CSS custom properties (dark + light) |
| Backend | FastAPI, SQLite via aiosqlite |
| AI Pipeline | DeepSeek `deepseek-chat` (OpenAI-compatible API) |
| Synthetic Feed | DeepSeek `deepseek-chat` (via Vite proxy) |
| Data Source | CFPB Consumer Complaint Database — public API |
