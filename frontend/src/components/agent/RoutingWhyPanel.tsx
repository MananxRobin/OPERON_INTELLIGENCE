import type { FullAnalysis } from '../../store';

function prettyLabel(value?: string | null) {
  if (!value) return 'Unknown';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildDrivers(analysis: FullAnalysis | null) {
  const complaint: FullAnalysis['complaint'] = analysis?.complaint ?? { narrative: '' };
  const classification = analysis?.classification ?? null;
  const compliance = analysis?.compliance_risk ?? null;
  const routing = analysis?.routing ?? null;
  const tags = complaint.tags ?? [];

  const items = [
    { label: 'Product', value: classification?.product ?? complaint.product },
    { label: 'Issue', value: classification?.issue },
    { label: 'Risk', value: compliance?.risk_level ? `${compliance.risk_level} · ${compliance.risk_score ?? '?'}/100` : null },
    { label: 'Priority', value: routing?.priority ? prettyLabel(routing.priority) : null },
    { label: 'SLA', value: routing?.sla_hours ? `${routing.sla_hours}h first response` : null },
    { label: 'Channel', value: complaint.channel },
  ];

  if (compliance?.requires_escalation) items.push({ label: 'Escalation', value: 'Compliance escalation required' });
  if (tags.length) items.push({ label: 'Tags', value: tags.join(', ') });

  return items.filter((item) => item.value);
}

export function RoutingWhyPanel({ analysis }: { analysis: FullAnalysis | null }) {
  const routing = analysis?.routing ?? null;
  const drivers = buildDrivers(analysis);

  return (
    <article className="panel" style={{ padding: 16 }}>
      <div className="section-label" style={{ marginBottom: 10 }}>Why It Routed Here</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>
        {routing?.assigned_team ?? 'Pending routing'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7, marginBottom: 12 }}>
        {routing?.because ?? routing?.reasoning ?? 'Routing reasoning appears after the routing stage completes.'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {drivers.map((driver) => (
          <div key={`${driver.label}-${driver.value}`} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {driver.label}
            </div>
            <div style={{ fontSize: 10, color: 'var(--primary)', lineHeight: 1.5 }}>{driver.value}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
