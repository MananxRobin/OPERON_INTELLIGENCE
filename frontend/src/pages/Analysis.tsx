import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';

import { ACCENT, PALETTE } from '../constants';
import { useStore } from '../store';

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="chart-tooltip">
      <div style={{ color: 'var(--text-weak)', fontSize: 10, marginBottom: 4 }}>{label}</div>
      {payload.map((entry: any, index: number) => (
        <div key={index} style={{ color: entry.color ?? 'var(--primary)', fontWeight: 600 }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}

export default function Analysis() {
  const complaints = useStore((state) => state.processedComplaints);
  const trends = useStore((state) => state.backendTrends);

  const kpis = useMemo(() => {
    const total = complaints.length;
    const critical = complaints.filter((complaint) => complaint.risk_level === 'CRITICAL').length;
    const review = complaints.filter((complaint) => complaint.needs_human_review).length;
    const divergent = complaints.filter((complaint) => (complaint.baseline_delta?.divergence_score ?? 0) >= 2).length;
    const sla = complaints.filter((complaint) => complaint.sla_breach_risk).length;
    const avgCriticality = total ? Math.round(complaints.reduce((sum, complaint) => sum + (complaint.criticality_score ?? 0), 0) / total) : 0;
    return { total, critical, review, divergent, sla, avgCriticality };
  }, [complaints]);

  const escalationByDay = useMemo(() => {
    const map: Record<string, { date: string; review: number; critical: number; sla: number }> = {};
    complaints.forEach((complaint) => {
      const day = complaint.submitted_at.slice(5, 10);
      if (!map[day]) map[day] = { date: day, review: 0, critical: 0, sla: 0 };
      if (complaint.needs_human_review) map[day].review++;
      if (complaint.risk_level === 'CRITICAL') map[day].critical++;
      if (complaint.sla_breach_risk) map[day].sla++;
    });
    return Object.values(map).sort((left, right) => left.date.localeCompare(right.date));
  }, [complaints]);

  const teamPressure = useMemo(() => {
    const map: Record<string, { total: number; review: number }> = {};
    complaints.forEach((complaint) => {
      const team = complaint.assigned_team ?? 'Unassigned';
      if (!map[team]) map[team] = { total: 0, review: 0 };
      map[team].total++;
      if (complaint.needs_human_review) map[team].review++;
    });
    return Object.entries(map)
      .sort((left, right) => right[1].total - left[1].total)
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.replace(' Team', ''), total: value.total, review: value.review }));
  }, [complaints]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Analysis</h1>
        <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
          AI output vs baseline workflow, escalation concentration, and criticality patterns
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {[
          { label: 'Analyzed', value: kpis.total, sub: 'total complaints' },
          { label: 'Critical', value: kpis.critical, sub: 'regulatory risk', accent: true },
          { label: 'Needs Review', value: kpis.review, sub: 'supervisor gate' },
          { label: 'Divergent', value: kpis.divergent, sub: 'AI vs baseline' },
          { label: 'SLA Exposure', value: kpis.sla, sub: 'breach risk' },
          { label: 'Avg Criticality', value: kpis.avgCriticality, sub: 'operational score' },
        ].map((card) => (
          <div key={card.label} className="stat-card" style={{ padding: '16px 16px 14px' }}>
            <div className="stat-card__label">{card.label}</div>
            <div className="stat-card__value" style={{ fontSize: 22, color: card.accent ? 'var(--accent)' : 'var(--primary)' }}>{card.value}</div>
            <div className="stat-card__sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Escalation Concentration</span>
          </div>
          <div style={{ padding: '14px 18px 12px' }}>
            <ComposedChart width={420} height={170} data={escalationByDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="review" name="Needs Review" stroke={ACCENT} fill="url(#analysisArea)" strokeWidth={1.5} />
              <Line type="monotone" dataKey="critical" name="Critical" stroke="var(--secondary)" strokeWidth={1.2} dot={false} />
              <Line type="monotone" dataKey="sla" name="SLA" stroke="var(--text-weak)" strokeWidth={1.1} dot={false} />
              <defs>
                <linearGradient id="analysisArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
            </ComposedChart>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Criticality Distribution</span>
          </div>
          <div style={{ padding: '14px 18px 12px' }}>
            <BarChart width={420} height={170} data={trends?.criticality_breakdown ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {(trends?.criticality_breakdown ?? []).map((entry, index) => (
                  <Cell key={entry.name} fill={PALETTE[index] ?? 'var(--muted-3)'} />
                ))}
              </Bar>
            </BarChart>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">AI vs Baseline Breakdown</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(trends?.baseline_divergence_breakdown ?? []).map((entry) => (
              <div key={entry.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--secondary)' }}>{entry.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--primary)' }}>{entry.value}</span>
                </div>
                <div className="hbar-track">
                  <div
                    className="hbar-fill"
                    style={{
                      width: `${Math.min(100, (entry.value / Math.max(1, complaints.length)) * 100)}%`,
                      background: entry.name === 'divergent' ? 'var(--accent)' : 'var(--secondary)',
                    }}
                  />
                </div>
              </div>
            ))}
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-weak)', lineHeight: 1.6 }}>
              Divergent cases often correspond to fraud-like narratives, vulnerable tags, or stricter routing/SLA choices than the rules-only workflow.
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Team Pressure</span>
          </div>
          <div style={{ padding: '14px 18px 12px' }}>
            <BarChart width={540} height={190} data={teamPressure} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="total" name="Volume" fill="var(--muted-3)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="review" name="Needs Review" fill={ACCENT} radius={[2, 2, 0, 0]} />
            </BarChart>
          </div>
        </div>
      </div>
    </div>
  );
}
