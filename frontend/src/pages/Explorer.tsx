import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../services/api';
import { useStore } from '../store';
import type { ComplaintSummary, IntakePreviewResponse } from '../store';

type SortKey = 'submitted_at' | 'product' | 'customer_state' | 'risk_level' | 'criticality_score' | 'source';
type QueueView = 'All' | 'Needs Human Review' | 'High Regulatory Risk' | 'SLA Breach Risk';
type ExplorerTab = 'ingestion' | 'schema' | 'queue';

const FALLBACK_COLUMNS = [
  'intake_id',
  'received_at',
  'channel',
  'source_system',
  'consumer_name',
  'consumer_id',
  'account_id',
  'product',
  'issue',
  'customer_state',
  'narrative',
  'consent_status',
  'attachment_count',
  'priority_hint',
];

function riskOrder(level: string | null) {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[level ?? 'LOW'] ?? 4;
}

function sourceLabel(source: string) {
  return (source || 'unknown').replaceAll('_', ' ');
}

function matchesQueue(complaint: ComplaintSummary, queue: QueueView) {
  if (queue === 'All') return true;
  if (queue === 'Needs Human Review') return complaint.needs_human_review;
  if (queue === 'High Regulatory Risk') return complaint.risk_level === 'CRITICAL' || complaint.risk_level === 'HIGH';
  if (queue === 'SLA Breach Risk') return complaint.sla_breach_risk;
  return true;
}

function buildFallbackPreview(complaints: ComplaintSummary[]): IntakePreviewResponse {
  const rows = complaints.slice(0, 16).map((complaint, index) => ({
    intake_id: `ING-${String(index + 1).padStart(4, '0')}`,
    received_at: complaint.submitted_at,
    channel: complaint.channel === 'web' ? 'form' : complaint.channel,
    source_system: complaint.source ?? 'ops_portal',
    consumer_name: `Consumer ${index + 1}`,
    consumer_id: complaint.customer_id ?? `CUST-${String(index + 1).padStart(6, '0')}`,
    account_id: `ACC-${String(index + 1).padStart(6, '0')}`,
    product: complaint.product ?? 'Unknown',
    issue: complaint.issue ?? 'Complaint intake',
    customer_state: complaint.customer_state ?? '',
    narrative: complaint.narrative_preview,
    consent_status: 'captured',
    attachment_count: index % 3 === 0 ? 1 : 0,
    priority_hint: complaint.priority ?? '',
  }));

  const channels = ['phone', 'email', 'ai_chat', 'form'] as const;
  return {
    canonical_columns: FALLBACK_COLUMNS,
    sections: channels.map((channel) => ({
      channel,
      label: channel === 'ai_chat' ? 'AI Chat' : channel[0].toUpperCase() + channel.slice(1),
      description: {
        phone: 'Contact-center transcripts, QA notes, assisted-service escalations',
        email: 'Support inboxes, executive response, complaint mailboxes',
        ai_chat: 'Assistant handoffs, chat summaries, intent capture',
        form: 'Web forms, authenticated complaint cases, branch-assisted intake',
      }[channel],
      count: rows.filter((row) => row.channel === channel).length,
    })),
    rows,
  };
}

export default function Explorer() {
  const navigate = useNavigate();
  const complaints = useStore((state) => state.processedComplaints);

  const [tab, setTab] = useState<ExplorerTab>('ingestion');
  const [intakePreview, setIntakePreview] = useState<IntakePreviewResponse | null>(null);

  const [queueView, setQueueView] = useState<QueueView>('All');
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState('ALL');
  const [product, setProduct] = useState('ALL');
  const [state, setState] = useState('ALL');
  const [channel, setChannel] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [reviewStatus, setReviewStatus] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('submitted_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        const payload = await api.intakePreview();
        if (!cancelled) setIntakePreview(payload);
      } catch {
        if (!cancelled) setIntakePreview(null);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(
    () => intakePreview ?? buildFallbackPreview(complaints),
    [complaints, intakePreview]
  );

  const products = useMemo(() => ['ALL', ...new Set(complaints.map((row) => row.product).filter(Boolean) as string[]).values()].sort(), [complaints]);
  const states = useMemo(() => ['ALL', ...new Set(complaints.map((row) => row.customer_state).filter(Boolean) as string[]).values()].sort(), [complaints]);
  const channels = useMemo(() => ['ALL', ...new Set(complaints.map((row) => row.channel).filter(Boolean)).values()].sort(), [complaints]);
  const sources = useMemo(() => ['ALL', ...new Set(complaints.map((row) => row.source || 'unknown')).values()].sort(), [complaints]);
  const vulnerableTags = useMemo(() => ['ALL', ...new Set(complaints.flatMap((row) => row.vulnerable_tags || [])).values()].sort(), [complaints]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return complaints
      .filter((complaint) => matchesQueue(complaint, queueView))
      .filter((complaint) => risk === 'ALL' || complaint.risk_level === risk)
      .filter((complaint) => product === 'ALL' || complaint.product === product)
      .filter((complaint) => state === 'ALL' || complaint.customer_state === state)
      .filter((complaint) => channel === 'ALL' || complaint.channel === channel)
      .filter((complaint) => source === 'ALL' || complaint.source === source)
      .filter((complaint) => tagFilter === 'ALL' || (complaint.vulnerable_tags ?? []).includes(tagFilter))
      .filter((complaint) => {
        if (reviewStatus === 'ALL') return true;
        return reviewStatus === 'needs_review' ? complaint.needs_human_review : !complaint.needs_human_review;
      })
      .filter((complaint) => {
        if (!q) return true;
        return [
          complaint.complaint_id,
          complaint.product,
          complaint.issue,
          complaint.assigned_team,
          complaint.customer_state,
          complaint.channel,
          complaint.source,
          complaint.narrative_preview,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .sort((left, right) => {
        let compare = 0;
        if (sortKey === 'submitted_at') compare = left.submitted_at.localeCompare(right.submitted_at);
        if (sortKey === 'product') compare = String(left.product ?? '').localeCompare(String(right.product ?? ''));
        if (sortKey === 'customer_state') compare = String(left.customer_state ?? '').localeCompare(String(right.customer_state ?? ''));
        if (sortKey === 'risk_level') compare = riskOrder(left.risk_level) - riskOrder(right.risk_level);
        if (sortKey === 'criticality_score') compare = (left.criticality_score ?? 0) - (right.criticality_score ?? 0);
        if (sortKey === 'source') compare = String(left.source).localeCompare(String(right.source));
        return sortAsc ? compare : -compare;
      });
  }, [channel, complaints, product, query, queueView, reviewStatus, risk, sortAsc, sortKey, source, state, tagFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const canonicalRows = preview.rows.slice(0, 10);
  const canonicalColumns = preview.canonical_columns?.length ? preview.canonical_columns : FALLBACK_COLUMNS;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((value) => !value);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Explorer</h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            Company complaint intake, unified dataset schema, and downstream triage queue
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            ['ingestion', 'Ingestion'],
            ['schema', 'Normalized Dataset'],
            ['queue', 'Batch Queue'],
          ] as [ExplorerTab, string][]).map(([value, label]) => (
            <button
              key={value}
              className="btn btn-ghost"
              onClick={() => setTab(value)}
              style={{
                fontSize: 9,
                padding: '5px 9px',
                borderColor: tab === value ? 'var(--accent)' : 'var(--border)',
                color: tab === value ? 'var(--accent)' : 'var(--secondary)',
                background: tab === value ? 'var(--highlight)' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'ingestion' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            {preview.sections.map((section) => (
              <div key={section.channel} className="panel" style={{ padding: '16px 16px 14px' }}>
                <div className="section-label" style={{ marginBottom: 8 }}>{section.label}</div>
                <div style={{ fontSize: 22, color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>{section.count}</div>
                <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>{section.description}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}>
            <div className="panel">
              <div className="panel-header">
                <span className="section-label">Inbound Capture</span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{preview.rows.length} sample rows</span>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {preview.rows.slice(0, 6).map((row, index) => (
                  <div key={String(row.intake_id ?? index)} style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--primary)' }}>
                        {String(row.product ?? 'Unknown')} · {String(row.channel ?? 'form').replaceAll('_', ' ')}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{String(row.customer_state ?? '')}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>
                      {String(row.narrative ?? '').slice(0, 170)}{String(row.narrative ?? '').length > 170 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Unified Complaint Pipeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['Capture', 'Phone, email, AI chat, and forms all land in one intake layer.'],
                  ['Normalize', 'Every row is mapped into one canonical complaint schema before agents run.'],
                  ['Analyze', 'Classification, compliance, routing, review-gate, and resolution all use the same normalized shape.'],
                  ['Route', 'Internal teams receive the complaint plus customer dossier, prior complaints, credit stress, and account context.'],
                ].map(([label, desc], index) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 10 }}>
                    <div style={{ width: 22, height: 22, border: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--secondary)' }}>
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--primary)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>{desc}</div>
                    </div>
                  </div>
                ))}
                <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-weak)', lineHeight: 1.6 }}>
                  The key change is that the platform now behaves like an internal complaint-operations system for a bank or fintech, not a CFPB-only viewer.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'schema' && (
        <>
          <div className="panel" style={{ padding: 16 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Canonical Complaint Dataset</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {canonicalColumns.map((column) => (
                <span key={column} className="badge badge-gray">{column}</span>
              ))}
            </div>
          </div>

          <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <span className="section-label">Normalized Intake Rows</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                Only this dataset moves into AI analysis and routing
              </span>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1400 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 2 }}>
                  <tr>
                    {canonicalColumns.map((column) => (
                      <th key={column} style={{ whiteSpace: 'nowrap' }}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {canonicalRows.map((row, rowIndex) => (
                    <tr key={String(row.intake_id ?? rowIndex)}>
                      {canonicalColumns.map((column) => (
                        <td
                          key={`${rowIndex}-${column}`}
                          style={{
                            color: column === 'product' || column === 'consumer_id' ? 'var(--primary)' : 'var(--secondary)',
                            whiteSpace: column === 'narrative' ? 'normal' : 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: column === 'narrative' ? 320 : 150,
                          }}
                        >
                          {String(row[column] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'queue' && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['All', 'Needs Human Review', 'High Regulatory Risk', 'SLA Breach Risk'] as QueueView[]).map((view) => (
              <button
                key={view}
                className="btn btn-ghost"
                onClick={() => {
                  setQueueView(view);
                  setPage(0);
                }}
                style={{
                  fontSize: 9,
                  padding: '5px 9px',
                  borderColor: queueView === view ? 'var(--accent)' : 'var(--border)',
                  color: queueView === view ? 'var(--accent)' : 'var(--secondary)',
                  background: queueView === view ? 'var(--highlight)' : 'transparent',
                }}
              >
                {view}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 8, alignItems: 'center' }}>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search complaint ID, product, issue, team…"
              style={{ gridColumn: 'span 2', padding: '7px 12px', fontSize: 11 }}
            />
            <select value={risk} onChange={(e) => { setRisk(e.target.value); setPage(0); }} style={{ padding: '7px 10px', fontSize: 11 }}>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((value) => (
                <option key={value} value={value}>{value === 'ALL' ? 'All Risks' : value}</option>
              ))}
            </select>
            <select value={product} onChange={(e) => { setProduct(e.target.value); setPage(0); }} style={{ padding: '7px 10px', fontSize: 11 }}>
              {products.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All Products' : value}</option>)}
            </select>
            <select value={state} onChange={(e) => { setState(e.target.value); setPage(0); }} style={{ padding: '7px 10px', fontSize: 11 }}>
              {states.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All States' : value}</option>)}
            </select>
            <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(0); }} style={{ padding: '7px 10px', fontSize: 11 }}>
              {channels.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All Channels' : value}</option>)}
            </select>
            <select value={source} onChange={(e) => { setSource(e.target.value); setPage(0); }} style={{ padding: '7px 10px', fontSize: 11 }}>
              {sources.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All Sources' : sourceLabel(value)}</option>)}
            </select>
            <select value={tagFilter} onChange={(e) => { setTagFilter(e.target.value); setPage(0); }} style={{ padding: '7px 10px', fontSize: 11 }}>
              {vulnerableTags.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'Vulnerable Tags' : value}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={reviewStatus} onChange={(e) => { setReviewStatus(e.target.value); setPage(0); }} style={{ padding: '7px 10px', fontSize: 11, minWidth: 160 }}>
              <option value="ALL">All Review States</option>
              <option value="needs_review">Needs Human Review</option>
              <option value="cleared">Auto Cleared</option>
            </select>
            {(query || risk !== 'ALL' || product !== 'ALL' || state !== 'ALL' || channel !== 'ALL' || source !== 'ALL' || reviewStatus !== 'ALL' || tagFilter !== 'ALL') && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '5px 10px' }}
                onClick={() => {
                  setQuery('');
                  setRisk('ALL');
                  setProduct('ALL');
                  setState('ALL');
                  setChannel('ALL');
                  setSource('ALL');
                  setReviewStatus('ALL');
                  setTagFilter('ALL');
                  setPage(0);
                }}
              >
                Clear
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)' }}>
              {filtered.length.toLocaleString()} complaints
            </span>
          </div>

          <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 2 }}>
                  <tr>
                    <th style={{ width: 96, cursor: 'pointer' }} onClick={() => toggleSort('submitted_at')}>Date</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('product')}>Product</th>
                    <th>Issue</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('customer_state')}>State</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('risk_level')}>Risk</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('criticality_score')}>Criticality</th>
                    <th>Review</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('source')}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((complaint) => (
                    <tr key={complaint.complaint_id} onClick={() => navigate(`/complaints/${complaint.complaint_id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{complaint.submitted_at.slice(0, 10)}</td>
                      <td style={{ color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{complaint.product}</td>
                      <td style={{ color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{complaint.issue}</td>
                      <td style={{ color: 'var(--text-weak)' }}>{complaint.customer_state ?? '—'}</td>
                      <td>
                        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', color: complaint.risk_level === 'CRITICAL' ? 'var(--accent)' : complaint.risk_level === 'HIGH' ? 'var(--secondary)' : 'var(--text-weak)' }}>
                          {complaint.risk_level}
                        </span>
                      </td>
                      <td style={{ color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{complaint.criticality_score ?? '—'}</td>
                      <td>
                        {complaint.needs_human_review ? (
                          <span className="badge badge-red">Needs Review</span>
                        ) : (
                          <span className="badge badge-gray">Auto Clear</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-faint)', textTransform: 'capitalize' }}>{sourceLabel(complaint.source)}</td>
                    </tr>
                  ))}
                  {!pageRows.length && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 28 }}>
                        No complaints match the current triage filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                  Page {page + 1} of {pageCount} · {filtered.length} results
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 10px' }} onClick={() => setPage(0)} disabled={page === 0}>«</button>
                  <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 10px' }} onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>‹</button>
                  <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 10px' }} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}>›</button>
                  <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 10px' }} onClick={() => setPage(pageCount - 1)} disabled={page >= pageCount - 1}>»</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
