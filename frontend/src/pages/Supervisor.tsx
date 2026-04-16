import { useEffect, useState } from 'react';

import { AgentSubnav } from '../components/agent/AgentSubnav';
import { RoutingWhyPanel } from '../components/agent/RoutingWhyPanel';
import { api } from '../services/api';
import type { ComplaintSummary, FullAnalysis, SupervisorDashboardSnapshot } from '../store';

function QueuePanel({
  title,
  kicker,
  complaints,
  onSelect,
}: {
  title: string;
  kicker: string;
  complaints: ComplaintSummary[];
  onSelect: (complaintId: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>{kicker}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{title}</div>
        </div>
        <span className="badge badge-gray">{complaints.length}</span>
      </div>

      <div>
        {complaints.length ? complaints.map((complaint) => (
          <button
            key={complaint.complaint_id}
            onClick={() => onSelect(complaint.complaint_id)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderTop: '1px solid var(--border)',
              color: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--primary)' }}>{complaint.product ?? 'Unknown product'}</span>
              <span className={`badge ${complaint.risk_level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
                {complaint.risk_level ?? 'Pending'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.5, marginBottom: 6 }}>
              {complaint.issue ?? complaint.narrative_preview}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {complaint.needs_human_review && <span className="badge badge-red">Needs Review</span>}
              {complaint.sla_breach_risk && <span className="badge badge-gray">SLA Risk</span>}
              {!!complaint.vulnerable_tags.length && <span className="badge badge-gray">Vulnerable Tag</span>}
            </div>
          </button>
        )) : (
          <div style={{ padding: '22px 16px', color: 'var(--text-faint)', fontSize: 11 }}>
            No complaints in this queue right now.
          </div>
        )}
      </div>
    </section>
  );
}

function BriefDrawer({
  analysis,
  loading,
  onClose,
}: {
  analysis: FullAnalysis | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'var(--overlay)', display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ width: 460, height: '100%', background: 'var(--bg-1)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Supervisor Brief</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{analysis?.complaint_id ?? 'Loading…'}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 9, padding: '5px 10px' }}>Close</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Loading complaint details…</div>
          ) : !analysis ? (
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Could not load complaint details.</div>
          ) : (
            <>
              <article className="panel" style={{ padding: 16 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>Classification</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="badge badge-gray">{analysis.classification?.product ?? 'Unknown'}</span>
                  {analysis.compliance_risk?.risk_level && (
                    <span className={`badge ${analysis.compliance_risk.risk_level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
                      {analysis.compliance_risk.risk_level}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 6 }}>
                  {analysis.classification?.issue ?? 'Awaiting analysis'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7 }}>
                  {analysis.complaint?.narrative}
                </div>
              </article>

              <article className="panel" style={{ padding: 16 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>Compliance Assessment</div>
                <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7, marginBottom: 8 }}>
                  {analysis.compliance_risk?.reasoning ?? 'Compliance reasoning unavailable.'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(analysis.compliance_risk?.flags ?? []).slice(0, 5).map((flag) => (
                    <span key={`${flag.regulation}-${flag.description}`} className="badge badge-red">
                      {flag.regulation}
                    </span>
                  ))}
                </div>
              </article>

              <article className="panel" style={{ padding: 16 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>QA Review Signal</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className={`badge ${analysis.qa_validation?.passed ? 'badge-gray' : 'badge-red'}`}>
                    {analysis.qa_validation?.passed ? 'Passed' : 'Needs Review'}
                  </span>
                  {typeof analysis.qa_validation?.overall_score === 'number' && (
                    <span className="badge badge-gray">Score {Math.round(analysis.qa_validation.overall_score * 100)}%</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7 }}>
                  {analysis.qa_validation?.reasoning ?? 'QA reasoning unavailable.'}
                </div>
              </article>

              <RoutingWhyPanel analysis={analysis} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Supervisor() {
  const [snapshot, setSnapshot] = useState<SupervisorDashboardSnapshot | null>(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await api.dashboardSupervisor();
        if (!cancelled) {
          setSnapshot(payload);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load supervisor dashboard');
        }
      }
    }

    void load();
    const timer = window.setInterval(() => { void load(); }, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

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

  const counts = snapshot?.counts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AgentSubnav />

      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Supervisor Dashboard</h1>
        <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
          Track human-review cases, regulatory hotspots, vulnerable-tag queues, and SLA drift
        </p>
      </div>

      {error && (
        <div className="panel" style={{ padding: '10px 14px', color: 'var(--accent)', fontSize: 11 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          ['Needs Human Review', counts?.needs_human_review ?? 0, 'QA failures, escalations, or weak-evidence cases.'],
          ['High Regulatory Risk', counts?.high_regulatory_risk ?? 0, 'HIGH or CRITICAL compliance exposure.'],
          ['SLA Breach Risk', counts?.sla_breach_risk ?? 0, 'Cases drifting near or beyond response windows.'],
          ['Vulnerable-Customer Queue', counts?.vulnerable_customer_cases ?? 0, 'Tagged protected or sensitive populations.'],
        ].map(([label, value, detail]) => (
          <div key={label} className="stat-card">
            <div className="stat-card__label">{label}</div>
            <div className="stat-card__value">{value}</div>
            <div className="stat-card__sub">{detail}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <QueuePanel
          title="Needs Review"
          kicker="Supervisor queue"
          complaints={snapshot?.queues?.needs_human_review ?? []}
          onSelect={setSelectedComplaintId}
        />
        <QueuePanel
          title="High Risk"
          kicker="Regulatory watch"
          complaints={snapshot?.queues?.high_regulatory_risk ?? []}
          onSelect={setSelectedComplaintId}
        />
        <QueuePanel
          title="SLA Risk"
          kicker="Timing watch"
          complaints={snapshot?.queues?.sla_breach_risk ?? []}
          onSelect={setSelectedComplaintId}
        />
      </div>

      {selectedComplaintId && (
        <BriefDrawer
          analysis={analysis}
          loading={loadingDetail}
          onClose={() => {
            setSelectedComplaintId('');
            setAnalysis(null);
          }}
        />
      )}
    </div>
  );
}
