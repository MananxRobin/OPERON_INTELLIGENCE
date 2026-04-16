import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useStore } from '../store';
import type { ComplaintSummary } from '../store';

type SortKey = 'submitted_at' | 'product' | 'customer_state' | 'risk_level' | 'criticality_score' | 'source';
type QueueView = 'All' | 'Needs Human Review' | 'High Regulatory Risk' | 'SLA Breach Risk';

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

export default function Explorer() {
  const navigate = useNavigate();
  const complaints = useStore((state) => state.processedComplaints);

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

  const products = useMemo(() => ['ALL', ...new Set(complaints.map((row) => row.product).filter(Boolean) as string[]).values()].sort(), [complaints]);
  const states = useMemo(() => ['ALL', ...new Set(complaints.map((row) => row.customer_state).filter(Boolean) as string[]).values()].sort(), [complaints]);
  const channels = useMemo(() => ['ALL', ...new Set(complaints.map((row) => row.channel).filter(Boolean)).values()].sort(), [complaints]);
  const sources = useMemo(() => ['ALL', ...new Set(complaints.map((row) => row.source || 'unknown')).values()].sort(), [complaints]);
  const vulnerableTags = useMemo(() => ['ALL', ...new Set(complaints.flatMap((row) => row.vulnerable_tags || [])).values()].sort(), [complaints]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = complaints
      .filter((complaint) => matchesQueue(complaint, queueView))
      .filter((complaint) => risk === 'ALL' || complaint.risk_level === risk)
      .filter((complaint) => product === 'ALL' || complaint.product === product)
      .filter((complaint) => state === 'ALL' || complaint.customer_state === state)
      .filter((complaint) => channel === 'ALL' || complaint.channel === channel)
      .filter((complaint) => source === 'ALL' || complaint.source === source)
      .filter((complaint) => tagFilter === 'ALL' || complaint.vulnerable_tags.includes(tagFilter))
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
    return next;
  }, [channel, complaints, product, query, queueView, reviewStatus, risk, sortAsc, sortKey, source, state, tagFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

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
            Batch triage by risk, source, vulnerable tags, and supervisor queue
          </p>
        </div>
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
    </div>
  );
}
