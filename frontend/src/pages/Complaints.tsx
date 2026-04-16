import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AgentSubnav } from '../components/agent/AgentSubnav';
import { api } from '../services/api';
import { useStore } from '../store';
import type { EvidenceReference, FullAnalysis } from '../store';

type EvidenceFocus = 'severity' | 'compliance' | 'routing' | 'review';

const FOCUS_LABELS: Record<EvidenceFocus, string> = {
  severity: 'Severity Evidence',
  compliance: 'Compliance Evidence',
  routing: 'Routing Evidence',
  review: 'Review Evidence',
};

function formatReason(code: string) {
  return code.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

function EvidenceChips({ refs }: { refs: EvidenceReference[] }) {
  if (!refs.length) {
    return <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>No direct evidence captured for this decision.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {refs.map((ref, index) => (
        <div key={`${ref.label}-${index}`} style={{ padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderLeft: '2px solid var(--accent)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {ref.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.6 }}>"{ref.quote}"</div>
        </div>
      ))}
    </div>
  );
}

function renderNarrative(text: string, refs: EvidenceReference[]) {
  const usable = refs
    .filter((ref) => Number.isFinite(ref.start) && Number.isFinite(ref.end) && ref.start >= 0 && ref.end > ref.start)
    .sort((a, b) => a.start - b.start);

  if (!usable.length) return text;

  const parts: Array<string | { text: string; label: string }> = [];
  let cursor = 0;
  for (const ref of usable) {
    if (ref.start < cursor) continue;
    if (cursor < ref.start) parts.push(text.slice(cursor, ref.start));
    parts.push({ text: text.slice(ref.start, ref.end), label: ref.label });
    cursor = ref.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return parts.map((part, index) => {
    if (typeof part === 'string') return <span key={index}>{part}</span>;
    return (
      <mark
        key={index}
        style={{
          background: 'var(--highlight)',
          color: 'var(--primary)',
          padding: '0 2px',
          borderRadius: 2,
          boxShadow: 'inset 0 -1px 0 color-mix(in srgb, var(--accent) 35%, transparent)',
        }}
        title={part.label}
      >
        {part.text}
      </mark>
    );
  });
}

function CompareRow({ label, ai, baseline }: { label: string; ai: string; baseline: string }) {
  const changed = ai !== baseline;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{label}</span>
      <span style={{ fontSize: 10, color: changed ? 'var(--accent)' : 'var(--primary)' }}>{ai || '—'}</span>
      <span style={{ fontSize: 10, color: 'var(--secondary)' }}>{baseline || '—'}</span>
    </div>
  );
}

export default function Complaints() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const complaints = useStore((state) => state.processedComplaints);
  const search = useStore((state) => state.searchQuery);

  const [selected, setSelected] = useState<string | null>(id ?? complaints[0]?.complaint_id ?? null);
  const [detail, setDetail] = useState<FullAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<EvidenceFocus>('severity');

  const filtered = useMemo(() => {
    if (!search) return complaints;
    const q = search.toLowerCase();
    return complaints.filter((complaint) =>
      [
        complaint.product,
        complaint.issue,
        complaint.complaint_id,
        complaint.narrative_preview,
        complaint.assigned_team,
        complaint.source,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [complaints, search]);

  const loadDetail = useCallback(async (complaintId: string) => {
    setLoading(true);
    try {
      setDetail(await api.complaint(complaintId));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  useEffect(() => {
    if (id) setSelected(id);
  }, [id]);

  const evidenceRefs = detail?.evidence_map?.[focus] ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AgentSubnav />

      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Complaints</h1>
        <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
          Review complaint narratives, why-routing logic, evidence support, and supervisor triggers
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 176px)' }}>
      <div className="panel" style={{ width: 390, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-header">
          <span className="section-label">Processed Complaints</span>
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{filtered.length}</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 18px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 11 }}>
              {complaints.length === 0 ? 'No complaints processed yet.' : 'No matches.'}
            </div>
          ) : (
            filtered.map((complaint) => {
              const active = complaint.complaint_id === selected;
              return (
                <div
                  key={complaint.complaint_id}
                  onClick={() => {
                    setSelected(complaint.complaint_id);
                    navigate(`/complaints/${complaint.complaint_id}`, { replace: true });
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: active ? 'var(--panel-hover)' : 'transparent',
                    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--primary)' }}>
                      {complaint.product ?? 'Unknown product'}
                    </span>
                    <span className={`badge ${complaint.severity === 'CRITICAL' ? 'badge-red' : 'badge-dim'}`}>
                      {complaint.severity ?? complaint.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-weak)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {complaint.issue ?? complaint.narrative_preview}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {complaint.risk_score != null && (
                      <span style={{ fontSize: 9, color: complaint.risk_score >= 70 ? 'var(--accent)' : 'var(--text-mid)', fontVariantNumeric: 'tabular-nums' }}>
                        Risk {complaint.risk_score}
                      </span>
                    )}
                    {complaint.criticality_score != null && (
                      <span style={{ fontSize: 9, color: 'var(--secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        Criticality {complaint.criticality_score}
                      </span>
                    )}
                    {complaint.needs_human_review && (
                      <span className="badge badge-red">Review</span>
                    )}
                    <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{complaint.source.replaceAll('_', ' ')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-faint)', fontSize: 11 }}>
            Select a complaint to view details
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-faint)', fontSize: 11 }}>
            Loading…
          </div>
        ) : !detail ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-weak)', fontSize: 11 }}>
            Could not load details
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div className="panel-header" style={{ gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                  {detail.classification?.product ?? 'Analysis Result'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-weak)', marginTop: 3 }}>
                  ID: {detail.complaint_id}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {detail.compliance_risk && (
                  <span className={`badge ${detail.compliance_risk.risk_level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
                    {detail.compliance_risk.risk_level} · {detail.compliance_risk.risk_score}
                  </span>
                )}
                {detail.criticality && (
                  <span className={`badge ${detail.criticality.level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
                    Criticality {detail.criticality.score}
                  </span>
                )}
                {detail.review_gate?.needs_human_review && <span className="badge badge-red">Needs Review</span>}
                <button className="btn btn-ghost" onClick={() => navigate('/audit')} style={{ fontSize: 10 }}>
                  View Audit Trail →
                </button>
              </div>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: 16 }}>
                <div>
                  <div className="section-label" style={{ marginBottom: 10 }}>Complaint Narrative</div>
                  <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['severity', 'compliance', 'routing', 'review'] as EvidenceFocus[]).map((option) => (
                      <button
                        key={option}
                        className="btn btn-ghost"
                        onClick={() => setFocus(option)}
                        style={{
                          fontSize: 9,
                          padding: '5px 10px',
                          borderColor: focus === option ? 'var(--accent)' : 'var(--border)',
                          color: focus === option ? 'var(--accent)' : 'var(--secondary)',
                          background: focus === option ? 'var(--highlight)' : 'transparent',
                        }}
                      >
                        {FOCUS_LABELS[option]}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--secondary)', lineHeight: 1.9, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 2, padding: '14px 16px' }}>
                    {renderNarrative(detail.complaint.narrative || '—', evidenceRefs)}
                  </div>
                </div>

                <div>
                  <div className="section-label" style={{ marginBottom: 10 }}>{FOCUS_LABELS[focus]}</div>
                  <EvidenceChips refs={evidenceRefs} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {detail.classification && (
                  <div>
                    <div className="section-label" style={{ marginBottom: 10 }}>Classification</div>
                    {[
                      ['Product', detail.classification.product],
                      ['Issue', detail.classification.issue],
                      ['Severity', detail.classification.severity],
                      ['Urgency', detail.classification.urgency],
                      ['Confidence', `${Math.round((detail.classification.confidence ?? 0) * 100)}%`],
                    ].map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{key}</span>
                        <span style={{ fontSize: 10, color: 'var(--primary)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {detail.routing && (
                  <div>
                    <div className="section-label" style={{ marginBottom: 10 }}>Routing</div>
                    {[
                      ['Team', detail.routing.assigned_team],
                      ['Priority', detail.routing.priority],
                      ['SLA', `${detail.routing.sla_hours}h`],
                      ['Tier', detail.routing.assigned_tier],
                    ].map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{key}</span>
                        <span style={{ fontSize: 10, color: 'var(--primary)' }}>{value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                      <div className="section-label" style={{ marginBottom: 8 }}>Why Routed</div>
                      <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7 }}>
                        {detail.routing.because ?? detail.routing.reasoning}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {detail.baseline && (
                <div>
                  <div className="section-label" style={{ marginBottom: 10 }}>AI vs Baseline Workflow</div>
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '12px 14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                      <span />
                      <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Output</span>
                      <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Baseline</span>
                    </div>
                    <CompareRow label="Severity" ai={detail.classification?.severity ?? '—'} baseline={detail.baseline.severity} />
                    <CompareRow label="Risk" ai={detail.compliance_risk?.risk_level ?? '—'} baseline={detail.baseline.risk_level} />
                    <CompareRow label="Team" ai={detail.routing?.assigned_team ?? '—'} baseline={detail.baseline.assigned_team} />
                    <CompareRow label="Priority" ai={detail.routing?.priority ?? '—'} baseline={detail.baseline.priority} />
                    <CompareRow label="SLA" ai={detail.routing ? `${detail.routing.sla_hours}h` : '—'} baseline={`${detail.baseline.sla_hours}h`} />
                    <CompareRow label="Review" ai={detail.review_gate?.needs_human_review ? 'Needs Human Review' : 'Auto Clear'} baseline={detail.baseline.review_outcome} />
                    <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-weak)' }}>
                      Divergence score: {detail.baseline.comparison?.divergence_score ?? 0}
                    </div>
                  </div>
                </div>
              )}

              {detail.review_gate && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div className="section-label" style={{ marginBottom: 10 }}>Supervisor Review</div>
                    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: detail.review_gate.needs_human_review ? 'var(--accent)' : 'var(--secondary)', marginBottom: 8 }}>
                        {detail.review_gate.because}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {(detail.review_gate.review_reason_codes || []).map((reason) => (
                          <span key={reason} className="badge badge-red">{formatReason(reason)}</span>
                        ))}
                        {!detail.review_gate.review_reason_codes?.length && <span className="badge badge-gray">No Review Needed</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(detail.review_gate.queues || []).map((queue) => (
                          <div key={queue} style={{ fontSize: 10, color: 'var(--secondary)' }}>{queue}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {detail.criticality && (
                    <div>
                      <div className="section-label" style={{ marginBottom: 10 }}>Criticality Breakdown</div>
                      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 24, color: detail.criticality.level === 'CRITICAL' ? 'var(--accent)' : 'var(--primary)', fontWeight: 600 }}>
                            {detail.criticality.score}
                          </span>
                          <span className={`badge ${detail.criticality.level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
                            {detail.criticality.level}
                          </span>
                        </div>
                        {detail.criticality.components.map((component) => (
                          <div key={component.code} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--secondary)' }}>{component.label}</span>
                              <span style={{ fontSize: 10, color: 'var(--primary)' }}>{component.score}</span>
                            </div>
                            <div className="hbar-track">
                              <div className="hbar-fill" style={{ width: `${Math.min(100, component.score * 4)}%`, background: component.score >= 18 ? 'var(--accent)' : 'var(--secondary)' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detail.compliance_risk && detail.compliance_risk.flags.length > 0 && (
                <div>
                  <div className="section-label" style={{ marginBottom: 10 }}>Compliance Flags ({detail.compliance_risk.flags.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detail.compliance_risk.flags.map((flag, index) => (
                      <div key={`${flag.regulation}-${index}`} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 2, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>{flag.regulation}</span>
                          <span className={`badge ${['high', 'critical'].includes(flag.severity?.toLowerCase()) ? 'badge-red' : 'badge-dim'}`}>{flag.severity}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-weak)', lineHeight: 1.6 }}>{flag.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.resolution && (
                <div>
                  <div className="section-label" style={{ marginBottom: 10 }}>Action Plan</div>
                  {detail.resolution.action_plan.map((action, index) => (
                    <div key={index} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, minWidth: 14 }}>{index + 1}</span>
                      <span style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.6 }}>{action}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
