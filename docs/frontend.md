# Frontend Reference

## Design language

The UI keeps the existing Bloomberg-terminal-inspired shell:

- dense panel-based layout
- narrow sidebar navigation
- compact top bar
- neutral dark/light semantic tokens
- restrained accent usage for criticality and review states

No structural redesign was introduced in the production hardening pass. New functionality is surfaced through existing panels, drawers, tabs, tables, and detail views.

## Route map

### Overview

- `Synopsis` (`/`)
  - executive KPI cards
  - complaint volume trend
  - criticality composition
  - AI vs baseline divergence summary
  - supervisor queue snapshot
  - CFPB pulse
  - geographic state heatmap
  - product distribution bars
  - institution leaderboard
  - live complaint snapshot
- `Live Feed` (`/live`)
  - live/synthetic stream rows
  - source visibility
  - schedule controls and run history
- `Explorer` (`/explorer`)
  - ingestion sections: phone, email, AI chat, forms
  - canonical normalized dataset preview
  - batch triage queue with filters
- `Analysis` (`/analysis`)
  - escalation concentration chart
  - criticality distribution
  - AI vs baseline breakdown
  - internal team flow
  - customer dossier slice
- `Enforcement Radar` (`/enforcement`)
  - enforcement concentration and institution exposure
- `Institution Monitor` (`/institutions`)
  - institution-level complaint and risk monitoring

### Agent

- `Analyze` (`/analyze`)
  - manual complaint analysis
  - normalized intake preview and submission
  - streaming agent pipeline updates
- `Triage` (`/triage`)
  - batch queue filters and complaint drill-in
- `Supervisor` (`/supervisor`)
  - human-review, high-risk, and SLA-risk queues
- `Look-up` (`/lookup`)
  - customer dossier
  - complaint history
  - ticket timeline
  - account and credit context
- `Complaints` (`/complaints`)
  - complaint narrative with evidence highlighting
  - AI vs baseline comparison
  - routing rationale
  - ticket record and timeline
  - customer profile and internal team flow
- `Audit Trail` (`/audit`)
  - step-by-step agent decisions
  - evidence spans
  - review-gate and baseline trace

## Charts and visualizations

### Recharts-based

- area charts
- bar charts
- composed charts
- trend and distribution summaries

### Custom visualizations

- `StateHeatmap`
  - lightweight state-level complaint density display
- horizontal severity / criticality bars
- panel-level queue and institution leaderboards

## Frontend libraries

- `react`
- `react-dom`
- `react-router-dom`
- `zustand`
- `recharts`
- `vite`
- `typescript`
- `eslint`
- `vitest`

## Theme system

The app uses semantic CSS variables in `frontend/src/styles/globals.css`:

- dark and light themes share the same component structure
- theme state is persisted in local storage
- the top bar now uses a switch-style theme control

## Production notes

- The frontend can run standalone in development with Vite.
- For production, the backend serves the built frontend bundle.
- Synthetic fallback remains active so the app can function without live CFPB availability.
