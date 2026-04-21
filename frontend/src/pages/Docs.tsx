import { useState } from 'react';

// ─── Section anchor helper ────────────────────────────────────────────────────
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.01em', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7, marginBottom: 10 }}>{children}</p>;
}

function GlossaryEntry({ term, def }: { term: string; def: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.02em' }}>{term}</span>
      <span style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>{def}</span>
    </div>
  );
}

function StepCard({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 24, height: 24, borderRadius: 2, background: 'var(--bg-2)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-weak)', fontVariantNumeric: 'tabular-nums' }}>{String(n).padStart(2, '0')}</span>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

function RiskBadge({ level, color, desc }: { level: string; color: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', minWidth: 60, paddingTop: 1 }}>{level}</span>
      <span style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>{desc}</span>
    </div>
  );
}

const SECTIONS = [
  { id: 'overview',       label: 'Overview' },
  { id: 'navigation',     label: 'Navigation Guide' },
  { id: 'data-sources',   label: 'Data Sources' },
  { id: 'risk-scoring',   label: 'Risk Scoring' },
  { id: 'explainability', label: 'Explainability' },
  { id: 'glossary',       label: 'Glossary' },
  { id: 'regulations',    label: 'Regulations Reference' },
  { id: 'faq',            label: 'FAQ' },
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState('overview');

  function scrollTo(id: string) {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', overflow: 'hidden' }}>
      {/* Sticky table of contents */}
      <div style={{
        width: 180, flexShrink: 0, borderRight: '1px solid var(--border)',
        padding: '20px 0', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-faint)', textTransform: 'uppercase', padding: '0 18px 10px' }}>
          Contents
        </div>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 18px 7px 20px',
              background: 'transparent', border: 'none',
              borderLeft: `2px solid ${activeSection === s.id ? 'var(--accent)' : 'transparent'}`,
              color: activeSection === s.id ? 'var(--primary)' : 'var(--secondary)',
              fontSize: 10, cursor: 'pointer',
              fontWeight: activeSection === s.id ? 500 : 400,
              transition: 'color 0.1s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-weak)', textTransform: 'uppercase', marginBottom: 8 }}>
            Operon Intelligence · Documentation
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.03em', marginBottom: 10 }}>
            Dashboard Reference
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', lineHeight: 1.7 }}>
            Complete reference for Operon Intelligence — the real-time financial complaint intelligence platform
            built for financial institutions, compliance officers, and risk analysts.
          </p>
        </div>

        {/* Overview */}
        <Section id="overview" title="Overview">
          <Para>
            Operon Intelligence is a Bloomberg Terminal-style complaint intelligence platform for banks, lenders,
            and fintech operators. It ingests complaints from internal channels and external signals, normalizes
            them into one granular dataset, and drives real-time risk scoring, routing, explainability,
            and supervisor oversight from a single command centre.
          </Para>
          <Para>
            When the live CFPB API is reachable, all charts and tables reflect real complaint data updated
            continuously. When the API is unavailable (e.g. during offline demos), the system automatically
            switches to a statistically-representative synthetic pool generated from the same company,
            product, and state distributions as the real CFPB dataset — indicated by
            <strong style={{ color: 'var(--accent)' }}> CFPB SYNTHETIC</strong> in the header bar.
          </Para>
          <Para>
            An optional backend AI pipeline (FastAPI + multi-agent LangGraph) can be connected to perform
            deeper NLP classification, compliance risk analysis, and resolution routing on submitted complaints.
            When connected, the <strong style={{ color: 'var(--primary)' }}>Backend AI Analytics</strong> section
            in Synopsis populates with real AI-generated insights.
          </Para>
          <Para>
            The current prototype extends that flow with a deterministic
            <strong style={{ color: 'var(--primary)' }}> baseline workflow</strong>, an operational
            <strong style={{ color: 'var(--primary)' }}> criticality engine</strong>, a
            <strong style={{ color: 'var(--primary)' }}> supervisor review gate</strong>, and a
            <strong style={{ color: 'var(--primary)' }}> normalization intake lane</strong> for sparse CSV/JSON/API payloads.
            These layers make the system easier to defend in front of regulators and more useful for operations teams.
          </Para>
        </Section>

        {/* Navigation */}
        <Section id="navigation" title="Navigation Guide">
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', marginBottom: 10 }}>Overview Group</div>
            <StepCard n={1} title="Synopsis"
              desc="Command centre — CFPB KPI cards, volume trend, state heatmap, company risk chart, live stream, and complaint explorer. Default landing view." />
            <StepCard n={2} title="Live Feed"
              desc="Real-time CFPB complaint stream with geographic heatmap, risk breakdown, product distribution, and institution volume. Click any row to open a full complaint detail drawer." />
            <StepCard n={3} title="Explorer"
              desc="Full-dataset search with multi-filter (risk level, product, state) and sortable, paginated table. 50 rows per page across up to 500 recent complaints. Click any row to inspect." />
            <StepCard n={4} title="Analysis"
              desc="Detailed temporal analysis across 1D / 7D / 1M / 3M windows. Includes volume trend, risk breakdown over time, complaint routing queue, day-of-week distribution, product breakdown, risk distribution, and institution table with crit rates." />
            <StepCard n={5} title="Enforcement Radar"
              desc="Tracks CRITICAL and HIGH risk complaints that indicate potential enforcement action triggers — untimely responses, disputed resolutions, and high-volume institutional patterns." />
            <StepCard n={6} title="Institution Monitor"
              desc="Ranks financial institutions by composite risk score (crit rate × 0.5 + untimely rate × 0.3 + dispute rate × 0.2). Click any institution for a detailed breakdown by product and state." />
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', marginBottom: 10 }}>Agent Group</div>
            <StepCard n={1} title="Analyze"
              desc="Submit a complaint narrative for real-time AI analysis through a 5-agent pipeline: Classification → Compliance Risk → Routing → Resolution → QA Validation. Results stream via SSE." />
            <StepCard n={2} title="Complaints"
              desc="Browse all AI-processed complaint analyses from the backend. Search by query, filter by status. Drill into any complaint for the full analysis report and audit trail." />
            <StepCard n={3} title="Audit Trail"
              desc="Full agent-by-agent decision log for any processed complaint — confidence scores, evidence spans, reasoning chains, and timing for each pipeline agent." />
          </div>
        </Section>

        {/* Data Sources */}
        <Section id="data-sources" title="Data Sources">
          <Para>
            <strong style={{ color: 'var(--primary)' }}>Primary: CFPB Consumer Complaint Database.</strong>{' '}
            The Consumer Financial Protection Bureau publishes a public API at
            <code style={{ background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 2, fontSize: 10, color: 'var(--secondary)', margin: '0 4px' }}>
              consumerfinance.gov/data-research/consumer-complaints/search/api/v1
            </code>
            containing 4M+ complaints filed since 2011. Operon proxies this API and fetches the
            most recent complaints sorted by submission date. Each complaint includes product, issue,
            company, state, response type, and dispute status.
          </Para>
          <Para>
            <strong style={{ color: 'var(--primary)' }}>Fallback: AI-Synthetic Pool.</strong>{' '}
            When the CFPB API is unreachable, a statistically-equivalent pool is generated locally using
            weighted random sampling from real CFPB company, product, issue, and state distributions.
            The pool contains 600 complaints spanning 90 days. It is refreshed with 50 new AI-generated
            entries (via DeepSeek API) every 10 minutes during a session. All analytics and charts are
            identical regardless of source — the only difference is the
            <strong style={{ color: 'var(--accent)' }}> CFPB SYNTHETIC </strong>
            vs <strong style={{ color: 'var(--success)' }}> CFPB LIVE </strong> badge in the header.
          </Para>
          <Para>
            <strong style={{ color: 'var(--primary)' }}>Optional Backend: AI Pipeline.</strong>{' '}
            A FastAPI server on port 8000 exposes a multi-agent LangGraph pipeline built on Claude / DeepSeek.
            Run <code style={{ background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 2, fontSize: 10, color: 'var(--secondary)' }}>uvicorn api.main:app --port 8000</code> to
            enable the Agent group views and the Backend AI Analytics panel in Synopsis.
          </Para>
        </Section>

        {/* Risk Scoring */}
        <Section id="risk-scoring" title="Risk Scoring">
          <Para>
            Every complaint is assigned a risk level based on the combination of the company's response
            type and whether the consumer disputed the resolution. The formula is deterministic and
            matches the CFPB's own severity framework.
          </Para>

          <div style={{ marginBottom: 20 }}>
            <RiskBadge level="CRITICAL" color="var(--accent)"
              desc="Triggered when the company response is 'Untimely response' OR the consumer disputes the resolution. Represents the highest-priority complaints requiring immediate escalation. Score range: 76–100." />
            <RiskBadge level="HIGH" color="var(--secondary)"
              desc="Triggered when the response is 'Closed without relief' or is still 'In progress' past SLA. Indicates unresolved or inadequately handled complaints. Score range: 56–75." />
            <RiskBadge level="MEDIUM" color="var(--text-weak)"
              desc="Closed with non-monetary relief only. Consumer received acknowledgment but no financial remedy. Score range: 35–55." />
            <RiskBadge level="LOW" color="var(--text-faint)"
              desc="Complaint closed with monetary or full relief. Consumer satisfied. Score range: 10–34." />
          </div>

          <Para>
            <strong style={{ color: 'var(--primary)' }}>Institution Risk Score</strong> (used in Institution Monitor)
            is a composite metric:
          </Para>
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 2, padding: '12px 16px', marginBottom: 12 }}>
            <code style={{ fontSize: 10, color: 'var(--secondary)', fontFamily: 'monospace' }}>
              riskScore = (criticalRate × 0.50) + (untimelyRate × 0.30) + (disputeRate × 0.20)
            </code>
          </div>
          <Para>
            All three input rates are expressed as 0–100 percentages. The composite score is capped at 100.
            Institutions with riskScore ≥ 70 are flagged CRITICAL; ≥ 45 are HIGH; ≥ 20 are MEDIUM.
          </Para>
        </Section>

        <Section id="explainability" title="Explainability">
          <Para>
            Every analyzed complaint now carries a short <strong style={{ color: 'var(--primary)' }}>Why Routed</strong>
            explanation, a rules-only baseline comparison, and structured evidence references for severity,
            compliance, routing, and supervisor review. These references are rendered directly next to the
            original narrative so reviewers can see why the model escalated a case, not just where it sent it.
          </Para>
          <Para>
            The <strong style={{ color: 'var(--primary)' }}>criticality score</strong> is separate from compliance risk.
            It blends regulatory risk, customer harm, timeliness exposure, vulnerable-customer signals,
            unresolved/disputed context, and AI-vs-baseline divergence into one operational score used for
            queues and triage prioritisation.
          </Para>
          <Para>
            The <strong style={{ color: 'var(--primary)' }}>review gate</strong> pushes complaints into supervisor queues
            whenever QA fails, confidence is low, evidence support is weak, compliance risk is critical,
            normalization confidence is low, or the AI diverges materially from the deterministic baseline workflow.
          </Para>
        </Section>

        {/* Glossary */}
        <Section id="glossary" title="Glossary">
          <GlossaryEntry term="CFPB"
            def="Consumer Financial Protection Bureau — U.S. federal agency that collects and publishes consumer complaints against financial service providers." />
          <GlossaryEntry term="Complaint"
            def="A formal submission by a consumer documenting a problem with a financial product or service. The CFPB requires companies to respond within 15 days." />
          <GlossaryEntry term="Consumer Disputed"
            def="Flag set when the consumer explicitly disagrees with the company's resolution. Elevates the complaint to CRITICAL risk automatically." />
          <GlossaryEntry term="Untimely Response"
            def="A company response submitted after the regulatory 15-day SLA window. Automatically escalates the complaint to CRITICAL risk." />
          <GlossaryEntry term="Risk Score"
            def="A 0–100 numeric measure of a complaint's severity, computed from response type and dispute status. Drives the CRITICAL/HIGH/MEDIUM/LOW classification." />
          <GlossaryEntry term="Criticality"
            def="A separate operational severity score that blends regulatory risk, harm signals, timeliness exposure, vulnerable tags, unresolved context, and AI-vs-baseline divergence." />
          <GlossaryEntry term="Baseline Workflow"
            def="A deterministic rules-only workflow that assigns severity, routing, priority, SLA, and review outcome without using an LLM. Used as a comparison benchmark against the AI pipeline." />
          <GlossaryEntry term="Review Gate"
            def="Composite supervisor queue logic that marks complaints for human review when QA fails, confidence is low, critical compliance risk is detected, evidence is weak, normalization is uncertain, or AI output diverges from the baseline." />
          <GlossaryEntry term="Normalization"
            def="The intake process that converts sparse CSV/JSON/API records into Operon's complaint schema before analysis. Each row stores confidence, missing fields, and recommendations." />
          <GlossaryEntry term="Source Provenance"
            def="Explicit labeling of whether a record came from the live CFPB API, seeded synthetic data, DeepSeek-generated demo data, manual analysis, or a normalized batch." />
          <GlossaryEntry term="Enforcement Radar"
            def="Operon's view of complaints most likely to trigger CFPB enforcement action — those with untimely responses, high dispute rates, or pattern violations at a single institution." />
          <GlossaryEntry term="Institution Risk Score"
            def="Composite institution-level metric: 50% critical rate + 30% untimely rate + 20% dispute rate. Used to rank banks and servicers by systemic risk." />
          <GlossaryEntry term="Synthetic Pool"
            def="Locally-generated complaint dataset that mirrors real CFPB distributions when the live API is unavailable. Populated from weighted company, product, and state tables." />
          <GlossaryEntry term="SLA"
            def="Service Level Agreement — the 15-day regulatory window in which a company must respond to a CFPB complaint." />
          <GlossaryEntry term="SSE"
            def="Server-Sent Events — the streaming protocol used by the Analyze view to push agent pipeline updates to the browser in real time." />
          <GlossaryEntry term="Agent Pipeline"
            def="The backend's 5-agent LangGraph workflow: Classification → Compliance Risk → Routing → Resolution → QA Validation. Each agent runs a separate LLM call." />
          <GlossaryEntry term="NAL"
            def="Narrative Analysis — the NLP-based extraction of key entities, urgency indicators, and regulatory cues from a complaint's free-text narrative." />
          <GlossaryEntry term="Auto-Resolution Rate"
            def="Percentage of complaints the AI pipeline processes without requiring human review — those with LOW or MEDIUM risk and no regulatory flags." />
        </Section>

        {/* Regulations */}
        <Section id="regulations" title="Regulations Reference">
          <Para>
            The Operon Intelligence pipeline maps each complaint product to its applicable regulatory framework.
            These regulations govern the institutions' obligations and define what constitutes a compliance violation.
          </Para>
          {[
            { code: 'RESPA',   name: 'Real Estate Settlement Procedures Act',      applies: 'Mortgage servicing, escrow, transfers' },
            { code: 'TILA',    name: 'Truth in Lending Act',                       applies: 'Credit cards, mortgages, auto loans' },
            { code: 'ECOA',    name: 'Equal Credit Opportunity Act',               applies: 'Credit denial, adverse action, discrimination' },
            { code: 'HMDA',    name: 'Home Mortgage Disclosure Act',               applies: 'Mortgage data reporting, fair-lending analysis' },
            { code: 'FCRA',    name: 'Fair Credit Reporting Act',                  applies: 'Credit reporting errors, disputes, inquiries' },
            { code: 'FDCPA',   name: 'Fair Debt Collection Practices Act',         applies: 'Debt collection harassment, communication' },
            { code: 'FCBA',    name: 'Fair Credit Billing Act',                    applies: 'Billing errors, credit card disputes' },
            { code: 'BSA/AML', name: 'Bank Secrecy Act / Anti-Money Laundering',   applies: 'Account freezes, suspicious-activity flags' },
            { code: 'EFTA',    name: 'Electronic Fund Transfer Act',               applies: 'Debit card disputes, ACH errors, Reg E' },
            { code: 'HEA',     name: 'Higher Education Act',                       applies: 'Student loan servicing, income-driven plans' },
          ].map(r => (
            <div key={r.code} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--bg-1)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{r.code}</span>
              <span style={{ fontSize: 10, color: 'var(--primary)' }}>{r.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{r.applies}</span>
            </div>
          ))}
        </Section>

        {/* FAQ */}
        <Section id="faq" title="FAQ">
          {[
            {
              q: 'Why does the header show CFPB SYNTHETIC instead of CFPB LIVE?',
              a: 'The live CFPB API is occasionally rate-limited or unavailable. Operon automatically falls back to a locally-generated dataset that is statistically identical to real CFPB data. All charts, KPIs, and tables work identically — the badge simply informs you of the source.'
            },
            {
              q: 'What does clicking a complaint row open?',
              a: 'A slide-in detail drawer showing all available complaint fields: date, product, issue, institution, state, risk level, consumer dispute status, and untimely response flag. The Explorer view and Live Feed both support this interaction.'
            },
            {
              q: 'How do I connect the AI backend?',
              a: 'Run `cd backend && PYTHONPATH=. uvicorn api.main:app --port 8000 --reload` in a terminal. The Vite dev server proxies /api/* to port 8000. Once connected, the "Agent" nav group and "Backend AI Analytics" section in Synopsis will populate with real AI analyses.'
            },
            {
              q: 'How often does the data refresh?',
              a: 'The CFPB pool is seeded at startup (600 complaints). New DeepSeek-generated entries are added every 10 minutes. The Live Feed auto-refreshes every 60 seconds. The Synopsis live stream auto-refreshes every 60 seconds. The backend AI stats poll every 30 seconds.'
            },
            {
              q: 'What period options are available in Analysis?',
              a: '1D (last 24 hours), 7D (last week), 1M (last month / 30 days), 3M (last quarter / 90 days). Each period computes KPIs, volume trends, routing breakdowns, and institution tables for that exact window, with a comparison to the preceding equal-length period.'
            },
            {
              q: 'How is the Institution Risk Score calculated?',
              a: "riskScore = criticalRate × 0.50 + untimelyRate × 0.30 + disputeRate × 0.20, where each rate is the percentage of that institution's complaints in that time window. The score is capped at 100. Scores ≥ 70 = CRITICAL, ≥ 45 = HIGH, ≥ 20 = MEDIUM, < 20 = LOW."
            },
          ].map(({ q, a }) => (
            <div key={q} style={{ padding: '13px 0', borderBottom: '1px solid var(--bg-1)' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--primary)', marginBottom: 6 }}>{q}</div>
              <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.7 }}>{a}</div>
            </div>
          ))}
        </Section>

        {/* Footer */}
        <div style={{ paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>Operon Intelligence · Financial Complaint Intelligence Platform</span>
          <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>Built for Hackathon Demo · Data: CFPB Public API</span>
        </div>
      </div>
    </div>
  );
}
