import { useCallback, useMemo, useState } from 'react';

import { AgentSubnav } from '../components/agent/AgentSubnav';
import { BaselineComparisonPanel } from '../components/agent/BaselineComparisonPanel';
import { EvidencePanel } from '../components/agent/EvidencePanel';
import { RiskGauge } from '../components/agent/RiskGauge';
import { RoutingWhyPanel } from '../components/agent/RoutingWhyPanel';
import { api } from '../services/api';
import { useStore } from '../store';
import type { FullAnalysis, NormalizationPreviewResponse } from '../store';

const AGENTS = [
  { key: 'ClassificationAgent', label: 'Classification', desc: 'Product · issue · severity' },
  { key: 'ComplianceRiskAgent', label: 'Compliance Risk', desc: 'Regulation scoring · flags' },
  { key: 'RoutingAgent', label: 'Routing', desc: 'Team assignment · SLA' },
  { key: 'ResolutionAgent', label: 'Resolution', desc: 'Action plan · response draft' },
  { key: 'QAValidationAgent', label: 'QA Validation', desc: 'Accuracy · quality check' },
];

type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';
type ResultTab = 'action' | 'response' | 'comparison' | 'classification' | 'compliance';
type IntakeMode = 'manual' | 'normalize';

function formatReason(code: string) {
  return code.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function Analyze() {
  const samples = useStore((state) => state.sampleComplaints);

  const [intakeMode, setIntakeMode] = useState<IntakeMode>('manual');
  const [narrative, setNarrative] = useState('');
  const [product, setProduct] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [channel, setChannel] = useState('web');
  const [selectedSample, setSelectedSample] = useState('');

  const [normalizeText, setNormalizeText] = useState('');
  const [normalizeMode, setNormalizeMode] = useState<'heuristic' | 'llm_assisted'>('heuristic');
  const [normalizePreview, setNormalizePreview] = useState<NormalizationPreviewResponse | null>(null);
  const [normalizationError, setNormalizationError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [agentStatus, setAgentStatus] = useState<Record<string, { status: AgentStatus; msg: string; ms?: number }>>({});
  const [result, setResult] = useState<FullAnalysis | null>(null);
  const [tab, setTab] = useState<ResultTab>('action');
  const [error, setError] = useState<string | null>(null);

  const pickSample = useCallback((id: string) => {
    setSelectedSample(id);
    const sample = samples.find((entry) => entry.id === id);
    if (sample) {
      setNarrative(sample.narrative);
      setProduct(sample.product);
      setCustomerState(sample.customer_state);
      setChannel(sample.channel);
    }
  }, [samples]);

  const submitAnalysis = useCallback(async (body: object) => {
    setError(null);
    setResult(null);
    setRunning(true);
    setAgentStatus({});

    try {
      const { complaint_id } = await api.submit(body);

      await new Promise<void>((resolve, reject) => {
        api.stream(complaint_id, (event, data: FullAnalysis | { agent: string; status: AgentStatus; message: string; duration_ms?: number } | null) => {
          if (event === 'agent_update' && data && 'agent' in data) {
            setAgentStatus((prev) => ({
              ...prev,
              [data.agent]: { status: data.status, msg: data.message, ms: data.duration_ms },
            }));
          } else if (event === 'analysis_complete' && data && 'complaint_id' in data) {
            setResult(data);
            setRunning(false);
            setTab('action');
            resolve();
          } else if (event === 'error' || event === 'timeout') {
            reject(new Error(event === 'timeout' ? 'Analysis timed out' : 'Stream error'));
          }
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setRunning(false);
    }
  }, []);

  const runManual = useCallback(async () => {
    if (!narrative.trim() || running) return;
    await submitAnalysis({
      narrative,
      product: product || undefined,
      channel,
      customer_state: customerState || undefined,
      source: 'manual_analysis',
    });
  }, [channel, customerState, narrative, product, running, submitAnalysis]);

  const previewNormalization = useCallback(async () => {
    if (!normalizeText.trim()) return;
    setNormalizationError(null);
    try {
      const preview = await api.normalizePreview({
        mode: normalizeMode,
        text: normalizeText,
      });
      setNormalizePreview(preview);
    } catch (err) {
      setNormalizationError(err instanceof Error ? err.message : 'Normalization failed');
    }
  }, [normalizeMode, normalizeText]);

  const submitNormalized = useCallback(async () => {
    if (!normalizePreview?.rows.length || running) return;
    setNormalizationError(null);
    try {
      const response = await api.normalizeSubmit({
        mode: normalizeMode,
        text: normalizeText,
        source_name: 'Analyze intake',
        submit_for_analysis: true,
      });
      if (!response.submitted_ids.length) {
        setNormalizationError('No usable complaint rows were submitted.');
        return;
      }
      const firstRow = normalizePreview.rows[0];
      await submitAnalysis({
        complaint_id: response.submitted_ids[0],
        narrative: firstRow.normalized.narrative,
        product: firstRow.normalized.product || undefined,
        issue: firstRow.normalized.issue || undefined,
        company: firstRow.normalized.company || undefined,
        channel: firstRow.normalized.channel || 'web',
        customer_state: firstRow.normalized.customer_state || undefined,
        date_received: firstRow.normalized.date_received || undefined,
        tags: firstRow.normalized.tags || [],
        source: 'normalized_batch',
        source_label: 'Analyze intake',
        normalization_batch_id: response.batch_id,
        normalization_row_index: firstRow.row_index,
        normalization: {
          confidence: firstRow.confidence,
          missing_fields: firstRow.missing_fields,
          recommendations: firstRow.recommendations,
          used_llm: firstRow.used_llm,
        },
      });
    } catch (err) {
      setNormalizationError(err instanceof Error ? err.message : 'Normalized submission failed');
    }
  }, [normalizeMode, normalizePreview, normalizeText, running, submitAnalysis]);

  const dotColor = (status: AgentStatus) => (
    status === 'completed'
      ? 'var(--secondary)'
      : status === 'running'
        ? 'var(--primary)'
        : status === 'failed'
          ? 'var(--accent)'
          : 'var(--text-faint)'
  );

  const previewRows = useMemo(() => normalizePreview?.rows.slice(0, 4) ?? [], [normalizePreview]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <AgentSubnav />

      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Analyze Complaint</h1>
        <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
          Run the 5-agent workflow, watch each specialist update live, and review the final resolution package
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              ['manual', 'Manual Analysis'],
              ['normalize', 'Normalize Intake'],
            ] as [IntakeMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                className="btn btn-ghost"
                onClick={() => setIntakeMode(mode)}
                style={{
                  fontSize: 10,
                  padding: '6px 10px',
                  borderColor: intakeMode === mode ? 'var(--accent)' : 'var(--border)',
                  color: intakeMode === mode ? 'var(--accent)' : 'var(--secondary)',
                  background: intakeMode === mode ? 'var(--highlight)' : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {intakeMode === 'manual' && samples.length > 0 && (
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-weak)', marginBottom: 10 }}>
                Sample Complaints ({samples.length})
              </div>
              <select value={selectedSample} onChange={(e) => pickSample(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 11 }}>
                <option value="">Select a sample complaint…</option>
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    [{sample.product}] {sample.narrative_preview.slice(0, 80)}…
                  </option>
                ))}
              </select>
            </div>
          )}

          {intakeMode === 'manual' ? (
            <div className="panel" style={{ padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 9, color: 'var(--text-weak)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Product</label>
                  <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. Credit card" style={{ width: '100%', padding: '7px 10px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, color: 'var(--text-weak)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>State</label>
                  <input value={customerState} onChange={(e) => setCustomerState(e.target.value)} placeholder="e.g. CA" style={{ width: '100%', padding: '7px 10px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, color: 'var(--text-weak)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Channel</label>
                  <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ width: '100%', padding: '7px 10px' }}>
                    <option value="web">Web</option>
                    <option value="phone">Phone</option>
                    <option value="referral">Referral</option>
                    <option value="postal_mail">Mail</option>
                    <option value="cfpb">CFPB</option>
                  </select>
                </div>
              </div>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Paste complaint narrative here…"
                rows={8}
                style={{ width: '100%', padding: '10px 12px', resize: 'vertical', lineHeight: 1.6 }}
              />
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn btn-accent" onClick={runManual} disabled={!narrative.trim() || running}>
                  {running ? 'Analyzing…' : 'Run Analysis'}
                </button>
                {error && <span style={{ fontSize: 11, color: 'var(--accent)' }}>{error}</span>}
                {narrative.length > 0 && <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>{narrative.length} chars</span>}
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 9, color: 'var(--text-weak)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Normalization mode</label>
                  <select value={normalizeMode} onChange={(e) => setNormalizeMode(e.target.value as 'heuristic' | 'llm_assisted')} style={{ width: 180, padding: '7px 10px' }}>
                    <option value="heuristic">Heuristic</option>
                    <option value="llm_assisted">LLM Assisted</option>
                  </select>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 18 }}>
                  Paste CSV, JSON, or a sparse API payload and preview how it maps into complaint schema.
                </div>
              </div>
              <textarea
                value={normalizeText}
                onChange={(e) => setNormalizeText(e.target.value)}
                placeholder="Paste CSV or JSON rows here…"
                rows={9}
                style={{ width: '100%', padding: '10px 12px', resize: 'vertical', lineHeight: 1.6, marginBottom: 12 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: normalizePreview ? 14 : 0 }}>
                <button className="btn btn-ghost" onClick={previewNormalization} disabled={!normalizeText.trim() || running}>
                  Preview Mapping
                </button>
                <button className="btn btn-accent" onClick={submitNormalized} disabled={!normalizePreview?.rows.length || running}>
                  Submit Normalized
                </button>
                {normalizationError && <span style={{ fontSize: 11, color: 'var(--accent)' }}>{normalizationError}</span>}
              </div>

              {normalizePreview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      ['Rows', normalizePreview.total_rows],
                      ['High Confidence', normalizePreview.high_confidence_rows],
                      ['Needs Review', normalizePreview.needs_review_rows],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 18, color: 'var(--primary)', fontWeight: 600 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {previewRows.map((row) => (
                      <div key={row.row_index} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 10, color: 'var(--primary)' }}>
                            Row {row.row_index + 1} · {row.normalized.product || 'Unknown product'}
                          </span>
                          <span style={{ fontSize: 10, color: row.confidence >= 0.85 ? 'var(--secondary)' : 'var(--accent)' }}>
                            {Math.round(row.confidence * 100)}%
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 6 }}>
                          {row.normalized.narrative || 'No narrative reconstructed.'}
                        </div>
                        {!!row.missing_fields.length && (
                          <div style={{ fontSize: 10, color: 'var(--text-weak)' }}>
                            Missing: {row.missing_fields.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Agent Pipeline</span>
            {running && <span style={{ fontSize: 9, color: 'var(--accent)', animation: 'pulse-ring 1s ease-out infinite' }}>RUNNING</span>}
          </div>
          <div>
            {AGENTS.map((agent, index) => {
              const current = agentStatus[agent.key];
              const status = current?.status ?? 'pending';
              return (
                <div key={agent.key} className="agent-step" style={{ opacity: status === 'pending' ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(status), display: 'block', flexShrink: 0 }} />
                    {index < AGENTS.length - 1 && <span style={{ width: 1, height: 24, background: 'var(--border)', display: 'block', marginTop: 3 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: status === 'running' ? 'var(--primary)' : 'var(--secondary)' }}>
                        {agent.label}
                      </span>
                      {current?.ms && <span style={{ fontSize: 9, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{current.ms}ms</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{current?.msg || agent.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 220px', gap: 16 }}>
            <div className="panel" style={{ padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span className="badge badge-gray">{result.classification?.product ?? 'Unknown Product'}</span>
                    {result.compliance_risk && (
                      <span className={`badge ${result.compliance_risk.risk_level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
                        {result.compliance_risk.risk_level}
                      </span>
                    )}
                    {result.review_gate?.needs_human_review && <span className="badge badge-red">Needs Review</span>}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>
                    {result.classification?.issue ?? 'Issue unavailable'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7 }}>
                    {result.classification?.reasoning ?? 'Classification reasoning unavailable.'}
                  </div>
                </div>
                <RiskGauge score={result.compliance_risk?.risk_score ?? 0} />
              </div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>QA Signal</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: result.qa_validation?.passed ? 'var(--secondary)' : 'var(--accent)', lineHeight: 1, marginBottom: 6 }}>
                {typeof result.qa_validation?.overall_score === 'number'
                  ? `${Math.round(result.qa_validation.overall_score * 100)}%`
                  : 'N/A'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 8 }}>
                {result.qa_validation?.passed ? 'Passed' : 'Needs Review'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-weak)', lineHeight: 1.7 }}>
                {result.qa_validation?.reasoning ?? 'QA reasoning unavailable.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <RoutingWhyPanel analysis={result} />
            <BaselineComparisonPanel analysis={result} />
          </div>

          <EvidencePanel analysis={result} />

          <div className="panel">
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 18px' }}>
            {([
              ['action', 'Action Plan'],
              ['response', 'Customer Response'],
              ['comparison', 'AI vs Baseline'],
              ['classification', 'Classification'],
              ['compliance', 'Compliance'],
            ] as [ResultTab, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                style={{
                  padding: '12px 16px 11px',
                  fontSize: 11,
                  fontWeight: tab === value ? 500 : 400,
                  color: tab === value ? 'var(--primary)' : 'var(--text-weak)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: tab === value ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 0 0 12px', gap: 10 }}>
              {result.total_processing_time_ms && <span style={{ fontSize: 9, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{result.total_processing_time_ms}ms</span>}
              {result.compliance_risk && (
                <span className={`badge ${result.compliance_risk.risk_level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>
                  {result.compliance_risk.risk_level} · {result.compliance_risk.risk_score}
                </span>
              )}
            </div>
            </div>

            <div style={{ padding: 20 }}>
            {tab === 'action' && result.resolution && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div className="section-label" style={{ marginBottom: 12 }}>Action Plan</div>
                  {result.resolution.action_plan.map((action, index) => (
                    <div key={index} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, minWidth: 16 }}>{index + 1}</span>
                      <span style={{ fontSize: 12, color: 'var(--primary)', lineHeight: 1.6 }}>{action}</span>
                    </div>
                  ))}
                </div>
                {result.routing && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      ['Assigned Team', result.routing.assigned_team],
                      ['Priority', result.routing.priority],
                      ['SLA', `${result.routing.sla_hours}h`],
                      ['Review', result.review_gate?.needs_human_review ? 'Needs Human Review' : 'Auto Clear'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 2, padding: '12px 14px' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'response' && result.resolution && (
              <div>
                <div className="section-label" style={{ marginBottom: 12 }}>Draft Customer Response</div>
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 2, padding: 16, fontSize: 12, color: 'var(--primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {result.resolution.customer_response}
                </div>
                {result.resolution.internal_notes && (
                  <>
                    <div className="section-label" style={{ marginTop: 18, marginBottom: 10 }}>Internal Notes</div>
                    <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7 }}>{result.resolution.internal_notes}</div>
                  </>
                )}
              </div>
            )}

            {tab === 'comparison' && result.baseline && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '14px 16px' }}>
                  <div className="section-label" style={{ marginBottom: 12 }}>AI vs Baseline</div>
                  {[
                    ['Severity', result.classification?.severity ?? '—', result.baseline.severity],
                    ['Risk', result.compliance_risk?.risk_level ?? '—', result.baseline.risk_level],
                    ['Team', result.routing?.assigned_team ?? '—', result.baseline.assigned_team],
                    ['Priority', result.routing?.priority ?? '—', result.baseline.priority],
                    ['SLA', result.routing ? `${result.routing.sla_hours}h` : '—', `${result.baseline.sla_hours}h`],
                    ['Review', result.review_gate?.needs_human_review ? 'Needs Human Review' : 'Auto Clear', result.baseline.review_outcome],
                  ].map(([label, aiValue, baselineValue]) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{label}</span>
                      <span style={{ fontSize: 10, color: aiValue !== baselineValue ? 'var(--accent)' : 'var(--primary)' }}>{aiValue}</span>
                      <span style={{ fontSize: 10, color: 'var(--secondary)' }}>{baselineValue}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {result.criticality && (
                    <div className="panel" style={{ padding: 16 }}>
                      <div className="section-label" style={{ marginBottom: 12 }}>Criticality</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 26, fontWeight: 600, color: result.criticality.level === 'CRITICAL' ? 'var(--accent)' : 'var(--primary)' }}>{result.criticality.score}</span>
                        <span className={`badge ${result.criticality.level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`}>{result.criticality.level}</span>
                      </div>
                      {result.criticality.components.map((component) => (
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
                  )}

                  {result.review_gate && (
                    <div className="panel" style={{ padding: 16 }}>
                      <div className="section-label" style={{ marginBottom: 12 }}>Review Gate</div>
                      <div style={{ fontSize: 10, color: result.review_gate.needs_human_review ? 'var(--accent)' : 'var(--secondary)', marginBottom: 10 }}>
                        {result.review_gate.because}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(result.review_gate.review_reason_codes || []).map((reason) => (
                          <span key={reason} className="badge badge-red">{formatReason(reason)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'classification' && result.classification && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div className="section-label" style={{ marginBottom: 12 }}>Classification Result</div>
                  {[
                    ['Product', result.classification.product],
                    ['Issue', result.classification.issue],
                    ['Severity', result.classification.severity],
                    ['Urgency', result.classification.urgency],
                    ['Confidence', `${(result.classification.confidence * 100).toFixed(0)}%`],
                    ['Sentiment', result.classification.sentiment_score.toFixed(2)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-weak)' }}>{label}</span>
                      <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="section-label" style={{ marginBottom: 12 }}>Key Entities</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.classification.key_entities.map((entity) => (
                      <span key={entity} className="badge badge-dim">{entity}</span>
                    ))}
                  </div>
                  <div className="section-label" style={{ marginTop: 16, marginBottom: 10 }}>Reasoning</div>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.7 }}>{result.classification.reasoning}</div>
                </div>
              </div>
            )}

            {tab === 'compliance' && result.compliance_risk && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span className={`badge ${result.compliance_risk.risk_level === 'CRITICAL' ? 'badge-red' : 'badge-gray'}`} style={{ fontSize: 11 }}>
                    {result.compliance_risk.risk_level}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{result.compliance_risk.risk_score}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.compliance_risk.flags.map((flag, index) => (
                      <div key={`${flag.regulation}-${index}`} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{flag.regulation}</span>
                          <span className={`badge ${['high', 'critical'].includes(flag.severity?.toLowerCase()) ? 'badge-red' : 'badge-dim'}`}>{flag.severity}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-soft)' }}>{flag.description}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="section-label" style={{ marginBottom: 10 }}>Reasoning</div>
                    <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7 }}>{result.compliance_risk.reasoning}</div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
