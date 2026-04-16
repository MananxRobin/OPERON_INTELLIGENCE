import { useCallback, useEffect, useMemo, useState } from 'react';

import { AgentSubnav } from '../components/agent/AgentSubnav';
import { api } from '../services/api';
import { useStore } from '../store';
import type { AuditEntry, FullAnalysis } from '../store';

const AGENT_ORDER = ['ClassificationAgent', 'ComplianceRiskAgent', 'RoutingAgent', 'ResolutionAgent', 'QAValidationAgent'];

function formatReason(code: string) {
  return code.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function AuditTrail() {
  const complaints = useStore((state) => state.processedComplaints);
  const analyzed = complaints.filter((complaint) => complaint.status === 'analyzed');

  const [selectedId, setSelectedId] = useState(analyzed[0]?.complaint_id ?? '');
  const [trail, setTrail] = useState<AuditEntry[]>([]);
  const [detail, setDetail] = useState<FullAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const [auditData, detailData] = await Promise.all([api.audit(id), api.complaint(id)]);
      setTrail(auditData.audit_trail ?? []);
      setDetail(detailData);
    } catch {
      setTrail([]);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) load(selectedId);
  }, [selectedId, load]);

  const sorted = useMemo(
    () => [...trail].sort((a, b) => AGENT_ORDER.indexOf(a.agent_name) - AGENT_ORDER.indexOf(b.agent_name)),
    [trail]
  );
  const totalMs = trail.reduce((sum, entry) => sum + (entry.duration_ms ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <AgentSubnav />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Audit Trail</h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            Agent decisions, evidence spans, baseline comparison, and supervisor review trace
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {analyzed.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{ padding: '8px 32px 8px 12px', fontSize: 11, minWidth: 280 }}
            >
              <option value="">Select complaint…</option>
              {analyzed.map((complaint) => (
                <option key={complaint.complaint_id} value={complaint.complaint_id}>
                  [{complaint.product ?? 'Unknown'}] {complaint.narrative_preview?.slice(0, 60)}…
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-weak)' }}>No analyzed complaints yet</span>
          )}
          {totalMs > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
              Total: {totalMs}ms
            </span>
          )}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-faint)', fontSize: 11 }}>Loading…</div>}

      {!loading && selectedId && detail && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          <div className="panel">
            <div className="panel-header">
              <span className="section-label">Agent Decision Chain</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{sorted.length} agents</span>
            </div>
            <div>
              {sorted.map((entry, index) => {
                const isExpanded = expanded === entry.agent_name;
                const confidence = entry.confidence != null ? `${(entry.confidence * 100).toFixed(0)}%` : null;

                return (
                  <div key={`${entry.agent_name}-${index}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px', cursor: 'pointer' }}
                      onClick={() => setExpanded(isExpanded ? null : entry.agent_name)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 2,
                            background: 'var(--bg-2)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            color: 'var(--secondary)',
                            fontWeight: 700,
                          }}
                        >
                          {index + 1}
                        </div>
                        {index < sorted.length - 1 && (
                          <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 14, marginTop: 3 }} />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                            {entry.agent_name.replace('Agent', ' Agent')}
                          </span>
                          <div style={{ display: 'flex', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                            {confidence && <span style={{ fontSize: 10, color: 'var(--secondary)', fontVariantNumeric: 'tabular-nums' }}>{confidence} conf</span>}
                            {entry.duration_ms && <span style={{ fontSize: 10, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{entry.duration_ms}ms</span>}
                            <span style={{ fontSize: 10, color: isExpanded ? 'var(--accent)' : 'var(--text-faint)' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.5, marginBottom: 4 }}>
                          {entry.decision}
                        </div>
                        {!isExpanded && entry.output_summary && (
                          <div style={{ fontSize: 10, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.output_summary}
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 18px 16px 54px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {entry.input_summary && (
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Input</div>
                            <div style={{ fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.6 }}>{entry.input_summary}</div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Reasoning</div>
                          <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7 }}>{entry.reasoning}</div>
                        </div>
                        {entry.evidence_spans?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Evidence</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {entry.evidence_spans.map((span, evidenceIndex) => (
                                <div
                                  key={`${entry.agent_name}-evidence-${evidenceIndex}`}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'var(--bg-2)',
                                    borderLeft: '2px solid var(--accent)',
                                    fontSize: 10,
                                    color: 'var(--text-soft)',
                                    lineHeight: 1.5,
                                    fontStyle: 'italic',
                                  }}
                                >
                                  "{span}"
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {entry.output_summary && (
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Output</div>
                            <div style={{ fontSize: 11, color: 'var(--primary)', lineHeight: 1.6 }}>{entry.output_summary}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="panel" style={{ padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Complaint</div>
              <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                {detail.complaint.narrative?.slice(0, 220)}…
              </div>
              {[
                ['Product', detail.classification?.product],
                ['Severity', detail.classification?.severity],
                ['Criticality', detail.criticality?.level ? `${detail.criticality.level} · ${detail.criticality.score}` : null],
                ['Source', detail.source_metadata?.source],
              ].map(([label, value]) =>
                value ? (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{label}</span>
                    <span style={{ fontSize: 10, color: 'var(--primary)' }}>{value}</span>
                  </div>
                ) : null
              )}
            </div>

            {detail.review_gate && (
              <div className="panel" style={{ padding: 16 }}>
                <div className="section-label" style={{ marginBottom: 12 }}>Review Gate</div>
                <div style={{ fontSize: 10, color: detail.review_gate.needs_human_review ? 'var(--accent)' : 'var(--secondary)', marginBottom: 10 }}>
                  {detail.review_gate.because}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(detail.review_gate.review_reason_codes || []).map((reason) => (
                    <span key={reason} className="badge badge-red">{formatReason(reason)}</span>
                  ))}
                  {!detail.review_gate.review_reason_codes?.length && <span className="badge badge-gray">No review needed</span>}
                </div>
              </div>
            )}

            {detail.baseline && (
              <div className="panel" style={{ padding: 16 }}>
                <div className="section-label" style={{ marginBottom: 12 }}>Baseline Workflow</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-faint)' }}>Team</span>
                    <span style={{ color: 'var(--primary)' }}>{detail.baseline.assigned_team}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-faint)' }}>Priority</span>
                    <span style={{ color: 'var(--primary)' }}>{detail.baseline.priority}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-faint)' }}>Divergence</span>
                    <span style={{ color: 'var(--accent)' }}>{detail.baseline.comparison?.divergence_score ?? 0}</span>
                  </div>
                </div>
              </div>
            )}

            {detail.evidence_map && (
              <div className="panel" style={{ padding: 16 }}>
                <div className="section-label" style={{ marginBottom: 12 }}>Evidence Coverage</div>
                {([
                  ['Severity', detail.evidence_map.severity.length],
                  ['Compliance', detail.evidence_map.compliance.length],
                  ['Routing', detail.evidence_map.routing.length],
                  ['Review', detail.evidence_map.review.length],
                ] as [string, number][]).map(([label, count]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-faint)' }}>{label}</span>
                    <span style={{ color: count > 0 ? 'var(--primary)' : 'var(--text-faint)' }}>{count}</span>
                  </div>
                ))}
              </div>
            )}

            {detail.normalization && (
              <div className="panel" style={{ padding: 16 }}>
                <div className="section-label" style={{ marginBottom: 12 }}>Normalization</div>
                <div style={{ fontSize: 10, color: 'var(--secondary)', marginBottom: 6 }}>
                  Confidence {Math.round((detail.normalization.confidence ?? 0) * 100)}%
                </div>
                {!!detail.normalization.missing_fields?.length && (
                  <div style={{ fontSize: 10, color: 'var(--text-weak)' }}>
                    Missing: {detail.normalization.missing_fields.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !selectedId && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-faint)', fontSize: 11 }}>
          {analyzed.length === 0 ? 'Run an analysis first to see audit trails.' : 'Select a complaint above.'}
        </div>
      )}
    </div>
  );
}
