import type { FullAnalysis } from '../../store';

function CompareRow({ label, ai, baseline }: { label: string; ai: string; baseline: string }) {
  const changed = ai !== baseline;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr 1fr', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{label}</span>
      <span style={{ fontSize: 10, color: changed ? 'var(--accent)' : 'var(--primary)' }}>{ai || '—'}</span>
      <span style={{ fontSize: 10, color: 'var(--secondary)' }}>{baseline || '—'}</span>
    </div>
  );
}

export function BaselineComparisonPanel({ analysis }: { analysis: FullAnalysis | null }) {
  const baseline = analysis?.baseline ?? null;
  if (!analysis || !baseline) {
    return (
      <article className="panel" style={{ padding: 16 }}>
        <div className="section-label" style={{ marginBottom: 10 }}>AI vs Baseline</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          Baseline comparison appears after a complaint has been analyzed.
        </div>
      </article>
    );
  }

  return (
    <article className="panel" style={{ padding: 16 }}>
      <div className="section-label" style={{ marginBottom: 10 }}>AI vs Baseline</div>
      <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr 1fr', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
        <span />
        <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI</span>
        <span style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Baseline</span>
      </div>
      <CompareRow label="Severity" ai={analysis.classification?.severity ?? '—'} baseline={baseline.severity} />
      <CompareRow label="Risk" ai={analysis.compliance_risk?.risk_level ?? '—'} baseline={baseline.risk_level} />
      <CompareRow label="Team" ai={analysis.routing?.assigned_team ?? '—'} baseline={baseline.assigned_team} />
      <CompareRow label="Priority" ai={analysis.routing?.priority ?? '—'} baseline={baseline.priority} />
      <CompareRow label="SLA" ai={analysis.routing ? `${analysis.routing.sla_hours}h` : '—'} baseline={`${baseline.sla_hours}h`} />
      <CompareRow label="Review" ai={analysis.review_gate?.needs_human_review ? 'Needs Human Review' : 'Auto Clear'} baseline={baseline.review_outcome} />

      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-weak)', lineHeight: 1.6 }}>
        {baseline.reasoning}
      </div>
      {!!baseline.factors?.length && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {baseline.factors.slice(0, 5).map((factor) => (
            <span key={`${factor.code}-${factor.points}`} className="badge badge-gray">
              {factor.code}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
