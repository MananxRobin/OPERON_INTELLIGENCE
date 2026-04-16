import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AgentSubnav } from '../components/agent/AgentSubnav';
import { RoutingWhyPanel } from '../components/agent/RoutingWhyPanel';
import { api } from '../services/api';
import type { ComplaintFilterOptions, ComplaintSummary, FullAnalysis } from '../store';

type FilterState = {
  product: string;
  risk_level: string;
  customer_state: string;
  channel: string;
  tag: string;
  vulnerable_only: boolean;
  needs_review: '' | 'true' | 'false';
  high_risk: '' | 'true' | 'false';
  source: string;
};

const INITIAL_FILTERS: FilterState = {
  product: '',
  risk_level: '',
  customer_state: '',
  channel: '',
  tag: '',
  vulnerable_only: false,
  needs_review: '',
  high_risk: '',
  source: '',
};

function toBool(value: '' | 'true' | 'false'): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function ComplaintListItem({
  complaint,
  active,
  onClick,
}: {
  complaint: ComplaintSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: active ? 'var(--panel-hover)' : 'transparent',
        border: 'none',
        borderTop: '1px solid var(--border)',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '12px 16px 12px 14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500 }}>
          {complaint.product ?? 'Unknown product'}
        </span>
        <span className={`badge ${complaint.risk_level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
          {complaint.risk_level ?? 'Pending'}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.5, marginBottom: 8 }}>
        {complaint.issue ?? complaint.narrative_preview}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {complaint.customer_state && <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{complaint.customer_state}</span>}
        {complaint.channel && <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{formatLabel(complaint.channel)}</span>}
        {complaint.needs_human_review && <span className="badge badge-red">Needs Review</span>}
        {!!complaint.vulnerable_tags.length && <span className="badge badge-gray">Vulnerable Tag</span>}
      </div>
    </button>
  );
}

export default function Triage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [options, setOptions] = useState<ComplaintFilterOptions | null>(null);
  const [complaints, setComplaints] = useState<ComplaintSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingList(true);
      try {
        const payload = await api.complaints({
          limit: 80,
          product: filters.product || undefined,
          risk_level: filters.risk_level || undefined,
          customer_state: filters.customer_state || undefined,
          channel: filters.channel || undefined,
          tag: filters.tag || undefined,
          vulnerable_only: filters.vulnerable_only || undefined,
          needs_review: toBool(filters.needs_review),
          high_risk: toBool(filters.high_risk),
          source: filters.source || undefined,
        });
        if (cancelled) return;
        setComplaints(payload.complaints ?? []);
        setTotalCount(payload.total ?? 0);
        setOptions(payload.available_filters ?? null);
        setSelectedComplaintId((current) => payload.complaints?.some((item) => item.complaint_id === current)
          ? current
          : (payload.complaints?.[0]?.complaint_id ?? ''));
        setError('');
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load triage queue');
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!selectedComplaintId) {
        setAnalysis(null);
        return;
      }
      setLoadingDetail(true);
      try {
        const payload = await api.complaint(selectedComplaintId);
        if (!cancelled) {
          setAnalysis(payload);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          setAnalysis(null);
          setError(loadError instanceof Error ? loadError.message : 'Could not load complaint detail');
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedComplaintId]);

  const summary = useMemo(() => ({
    total: totalCount,
    highRisk: complaints.filter((item) => item.risk_level === 'HIGH' || item.risk_level === 'CRITICAL').length,
    needsReview: complaints.filter((item) => item.needs_human_review).length,
    vulnerable: complaints.filter((item) => item.vulnerable_tags.length > 0).length,
  }), [complaints, totalCount]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AgentSubnav />

      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Triage Workbench</h1>
        <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
          Filter the queue by product, risk, state, tags, and review status before routing work
        </p>
      </div>

      {error && (
        <div className="panel" style={{ padding: '10px 14px', color: 'var(--accent)', fontSize: 11 }}>
          {error}
        </div>
      )}

      <div className="panel" style={{ padding: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Batch Triage</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Product</span>
            <select value={filters.product} onChange={(e) => updateFilter('product', e.target.value)} style={{ padding: '7px 10px', fontSize: 11 }}>
              <option value="">All</option>
              {(options?.products ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk</span>
            <select value={filters.risk_level} onChange={(e) => updateFilter('risk_level', e.target.value)} style={{ padding: '7px 10px', fontSize: 11 }}>
              <option value="">All</option>
              {(options?.risk_levels ?? []).map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>State</span>
            <select value={filters.customer_state} onChange={(e) => updateFilter('customer_state', e.target.value)} style={{ padding: '7px 10px', fontSize: 11 }}>
              <option value="">All</option>
              {(options?.states ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Channel</span>
            <select value={filters.channel} onChange={(e) => updateFilter('channel', e.target.value)} style={{ padding: '7px 10px', fontSize: 11 }}>
              <option value="">All</option>
              {(options?.channels ?? []).map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tag</span>
            <select value={filters.tag} onChange={(e) => updateFilter('tag', e.target.value)} style={{ padding: '7px 10px', fontSize: 11 }}>
              <option value="">All</option>
              {(options?.tags ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Needs Review</span>
            <select value={filters.needs_review} onChange={(e) => updateFilter('needs_review', e.target.value as FilterState['needs_review'])} style={{ padding: '7px 10px', fontSize: 11 }}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>High Risk</span>
            <select value={filters.high_risk} onChange={(e) => updateFilter('high_risk', e.target.value as FilterState['high_risk'])} style={{ padding: '7px 10px', fontSize: 11 }}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Source</span>
            <select value={filters.source} onChange={(e) => updateFilter('source', e.target.value)} style={{ padding: '7px 10px', fontSize: 11 }}>
              <option value="">All</option>
              {(options?.sources ?? []).map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--secondary)' }}>
            <input
              type="checkbox"
              checked={filters.vulnerable_only}
              onChange={(e) => updateFilter('vulnerable_only', e.target.checked)}
            />
            Vulnerable tags only
          </label>
          <button className="btn btn-ghost" style={{ fontSize: 9, padding: '5px 10px' }} onClick={() => setFilters(INITIAL_FILTERS)}>
            Clear Filters
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)' }}>
            {loadingList ? 'Refreshing…' : `${summary.total.toLocaleString()} visible cases`}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
          {[
            ['Visible Cases', summary.total],
            ['Needs Review', summary.needsReview],
            ['High Risk', summary.highRisk],
            ['Vulnerable Tag', summary.vulnerable],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--primary)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr', gap: 16, minHeight: 520 }}>
        <section className="panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <span className="section-label">Filtered Complaint Batch</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{complaints.length}</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {!complaints.length ? (
              <div style={{ padding: '28px 18px', color: 'var(--text-faint)', fontSize: 11 }}>
                No complaints match the current triage filters.
              </div>
            ) : (
              complaints.map((complaint) => (
                <ComplaintListItem
                  key={complaint.complaint_id}
                  complaint={complaint}
                  active={complaint.complaint_id === selectedComplaintId}
                  onClick={() => setSelectedComplaintId(complaint.complaint_id)}
                />
              ))
            )}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="panel" style={{ padding: 16 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Selected Case</div>
            {!selectedComplaintId ? (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Choose a complaint from the queue.</div>
            ) : loadingDetail ? (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Loading complaint detail…</div>
            ) : analysis ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span className="badge badge-gray">{analysis.classification?.product ?? 'Unknown Product'}</span>
                  {analysis.compliance_risk?.risk_level && (
                    <span className={`badge ${analysis.compliance_risk.risk_level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
                      {analysis.compliance_risk.risk_level}
                    </span>
                  )}
                  {analysis.review_gate?.needs_human_review && <span className="badge badge-red">Needs Review</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 6 }}>
                  {analysis.classification?.issue ?? 'Awaiting classification'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                  {analysis.complaint?.narrative}
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 9, padding: '5px 10px' }} onClick={() => navigate(`/complaints/${analysis.complaint_id}`)}>
                  Open Full Complaint
                </button>
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Could not load complaint detail.</div>
            )}
          </div>

          <RoutingWhyPanel analysis={analysis} />
        </section>
      </div>
    </div>
  );
}
