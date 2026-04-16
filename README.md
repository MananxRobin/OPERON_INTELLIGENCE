# Operon Intelligence

> Real-time financial complaint intelligence platform — Bloomberg Terminal-style dashboard for CFPB data analysis, risk scoring, and AI-powered complaint processing.

---

## Project Structure

```
Fin/
├── frontend/                     # React 19 + Vite 8 + TypeScript
│   ├── src/
│   │   ├── pages/                # Route-level views (lazy-loaded)
│   │   │   ├── Dashboard.tsx     # Synopsis — default landing view
│   │   │   ├── LiveFeed.tsx      # Real-time complaint stream + drawer
│   │   │   ├── Explorer.tsx      # Full-dataset search + filter table
│   │   │   ├── Analysis.tsx      # Temporal analysis (1D/7D/1M/3M)
│   │   │   ├── EnforcementRadar.tsx
│   │   │   ├── InstitutionMonitor.tsx
│   │   │   ├── Analyze.tsx       # Submit complaint → AI pipeline (SSE)
│   │   │   ├── Complaints.tsx    # Browse AI-processed complaints
│   │   │   ├── AuditTrail.tsx    # Agent-by-agent decision log
│   │   │   ├── Supervisor.tsx
│   │   │   ├── Triage.tsx
│   │   │   └── Docs.tsx          # Documentation + glossary
│   │   ├── components/layout/    # Sidebar, Topbar
│   │   ├── hooks/                # useCfpbData, useSyntheticFeed
│   │   ├── store/index.ts        # Zustand global state
│   │   ├── data/synthetic.ts     # 600-complaint synthetic pool generator
│   │   ├── services/             # CFPB API client, DeepSeek client
│   │   ├── styles/globals.css    # CSS design tokens (dark + light themes)
│   │   ├── constants.ts          # RISK_COLORS, PALETTE (CSS variable refs)
│   │   └── App.tsx               # Router + lazy route definitions
│   ├── .env.example              # Frontend env variables (copy → .env)
│   ├── vite.config.ts            # Vite config + API proxy rules
│   ├── package.json
│   └── index.html
│
├── backend/                      # FastAPI + LangGraph AI pipeline
│   ├── main.py                   # All REST + SSE endpoints
│   ├── database.py               # SQLite schema + query helpers
│   ├── agents/
│   │   ├── orchestrator.py       # LangGraph pipeline coordinator
│   │   ├── classification_agent.py
│   │   ├── compliance_agent.py
│   │   ├── routing_agent.py
│   │   ├── resolution_agent.py
│   │   └── qa_agent.py
│   ├── models/                   # Pydantic schemas
│   ├── data/sample_complaints.py # Seed complaints for demo/batch
│   ├── requirements.txt
│   └── .env.example              # Backend env variables (copy → .env)
│
├── .env.example                  # Combined reference for all variables
├── .gitignore
└── README.md
```

---

## Quick Start

### 1 — Clone and configure environment

```bash
git clone <repo-url>
cd Fin

# Frontend env
cp frontend/.env.example frontend/.env
# Edit frontend/.env — add VITE_DEEPSEEK_API_KEY (optional)

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env — add OPENAI_API_KEY (required for Agent views)
```

### 2 — Start the frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The dashboard is fully functional without the backend. All CFPB data views work immediately.

### 3 — Start the backend (optional)

Required only for the **Agent** sidebar group (Analyze, Complaints, Audit Trail, Supervisor, Triage).

```bash
# Create venv inside backend/ and install deps
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run from the project root (so `backend` is a resolvable Python package)
cd ..
backend/.venv/bin/python3 -m uvicorn backend.main:app --port 8000 --reload
# → http://localhost:8000
```

Vite proxies `/api/*` → `http://127.0.0.1:8000` automatically during dev.

---

## Environment Variables

See [`.env.example`](.env.example) for the full reference. Per-service copies:

| File | Variable | Required | Purpose |
|---|---|---|---|
| `frontend/.env` | `VITE_DEEPSEEK_API_KEY` | No | Refresh synthetic complaint pool every 10 min |
| `backend/.env` | `OPENAI_API_KEY` | For Agent views | Power the 5-agent LangGraph pipeline |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8 |
| State | Zustand v5 |
| Routing | React Router v7 (lazy-loaded) |
| Charts | Recharts v3 |
| Styling | CSS custom properties — dark/light themes |
| Backend | FastAPI, SQLite (aiosqlite) |
| AI Pipeline | LangGraph, OpenAI GPT-4o |
| Synthetic Feed | DeepSeek `deepseek-chat` (OpenAI-compatible API) |
| Data Source | CFPB Consumer Complaint Database (public API) |

---

## How Data Works

**Live mode** — `useCfpbData` fetches up to 250 complaints from the CFPB public API (proxied by Vite). The header shows **CFPB LIVE** in green.

**Synthetic mode** — When the CFPB API is unreachable, a 600-complaint pool generated from real CFPB company/product/state distributions is used automatically. The header shows **CFPB SYNTHETIC** in amber. No configuration needed — the fallback is transparent.

DeepSeek refreshes the synthetic pool with 50 new entries every 10 minutes if `VITE_DEEPSEEK_API_KEY` is set.

---

## Risk Scoring

| Level | Trigger |
|---|---|
| **CRITICAL** | Untimely response OR consumer disputed the resolution |
| **HIGH** | Closed without relief / still in progress past SLA |
| **MEDIUM** | Closed with non-monetary relief only |
| **LOW** | Closed with full monetary relief |

**Institution Risk Score** = `(critRate × 0.50) + (untimelyRate × 0.30) + (disputeRate × 0.20)`

---

## API Endpoints (Backend)

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/complaints` | List processed complaints (filterable) |
| POST | `/api/complaints/analyze` | Submit complaint for async AI analysis |
| GET | `/api/complaints/analyze/{id}/stream` | SSE stream of agent progress |
| GET | `/api/complaints/{id}` | Full analysis result |
| GET | `/api/audit/{id}` | Agent-by-agent audit trail |
| GET | `/api/dashboard/stats` | Aggregate KPIs |
| GET | `/api/dashboard/trends?days=14` | Volume trend data |
| GET | `/api/dashboard/supervisor` | Supervisor queue signals |
| POST | `/api/complaints/batch` | Batch-process sample complaints |

---

## Theming

Toggle dark/light with the **LIGHT / DARK** button in the top bar. All colors are CSS custom properties — no hardcoded hex anywhere in the component tree.

Dark default: `--bg: #0A0A0A` · `--primary: #F0EDE8` · `--accent: #E8433A`  
Light: `--bg: #f5f1ea` · `--primary: #181410` · `--accent: #cf4336`
