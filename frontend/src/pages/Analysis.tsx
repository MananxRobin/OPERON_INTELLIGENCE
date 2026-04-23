import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';

import { ACCENT, PALETTE } from '../constants';
import { api } from '../services/api';
import { useStore } from '../store';
import type { FullAnalysis, InternalTeamMetric } from '../store';

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

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function teamNameShort(name: string) {
  return name.replace(' Team', '').replace('Operations ', '');
}

export default function Analysis() {
  const navigate = useNavigate();
  const allComplaints = useStore((state) => state.processedComplaints);
  const totalProcessed = useStore((state) => state.totalProcessed);
  const trends = useStore((state) => state.backendTrends);
  const complaints = useMemo(
    () => allComplaints.filter((complaint) => complaint.channel === 'cfpb'),
    [allComplaints],
  );

  const [teamMetrics, setTeamMetrics] = useState<InternalTeamMetric[]>([]);
  const [selectedTeamName, setSelectedTeamName] = useState('');
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<FullAnalysis | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      try {
        const payload = await api.internalTeams();
        if (cancelled) return;
        setTeamMetrics(payload.teams ?? []);
        setSelectedTeamName((current) => current || payload.teams?.[0]?.name || '');
      } catch {
        if (!cancelled) setTeamMetrics([]);
      }
    }

    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(() => {
    const total = totalProcessed;
    const critical = complaints.filter((complaint) => complaint.risk_level === 'CRITICAL').length;
    const review = complaints.filter((complaint) => complaint.needs_human_review).length;
    const divergent = complaints.filter((complaint) => (complaint.baseline_delta?.divergence_score ?? 0) >= 2).length;
    const sla = complaints.filter((complaint) => complaint.sla_breach_risk).length;
    const avgCriticality = total ? Math.round(complaints.reduce((sum, complaint) => sum + (complaint.criticality_score ?? 0), 0) / total) : 0;
    return { total, critical, review, divergent, sla, avgCriticality };
  }, [complaints, totalProcessed]);

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
      .map(([name, value]) => ({ name: teamNameShort(name), total: value.total, review: value.review }));
  }, [complaints]);

  const selectedTeam = useMemo(
    () => teamMetrics.find((team) => team.name === selectedTeamName) ?? teamMetrics[0] ?? null,
    [selectedTeamName, teamMetrics]
  );

  useEffect(() => {
    if (!selectedTeam) return;
    const availableIds = new Set(selectedTeam.sample_complaints?.map((complaint) => complaint.complaint_id) ?? []);
    setSelectedComplaintId((current) => {
      if (current && availableIds.has(current)) return current;
      return selectedTeam.sample_complaints?.[0]?.complaint_id || '';
    });
  }, [selectedTeam]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!selectedComplaintId) {
        setSelectedDetail(null);
        return;
      }
      try {
        const payload = await api.complaint(selectedComplaintId);
        if (!cancelled) setSelectedDetail(payload);
      } catch {
        if (!cancelled) setSelectedDetail(null);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [complaints, selectedComplaintId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Analysis</h1>
        <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
          Working analytics, AI-vs-baseline deltas, and internal team routing with customer context
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
              Divergent cases are routed more aggressively because they carry stronger operational criticality, vulnerable-customer signals, or better evidence support than the rules-only path.
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 12, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Internal Teams</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{teamMetrics.length} queues</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {teamMetrics.map((team) => {
              const active = team.name === selectedTeam?.name;
              return (
                <button
                  key={team.name}
                  onClick={() => {
                    setSelectedTeamName(team.name);
                    setSelectedComplaintId(team.sample_complaints?.[0]?.complaint_id ?? '');
                  }}
                  style={{
                    textAlign: 'left',
                    background: active ? 'var(--panel-hover)' : 'var(--bg-2)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    padding: '12px 12px 10px',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 10, color: active ? 'var(--accent)' : 'var(--primary)', marginBottom: 6 }}>{team.name}</div>
                  <div style={{ fontSize: 18, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>{team.complaint_count}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-weak)', lineHeight: 1.6 }}>
                    {team.focus}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 9, color: 'var(--text-faint)' }}>
                    <span>{team.high_risk_count} high risk</span>
                    <span>{team.needs_review_count} review</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">{selectedTeam?.name ?? 'Team Detail'}</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{selectedTeam?.queue ?? '—'}</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selectedTeam ? (
              <>
                <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>{selectedTeam.focus}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {[
                    ['Avg Criticality', selectedTeam.avg_criticality],
                    ['Avg Credit Score', selectedTeam.avg_credit_score],
                    ['Queue Volume', selectedTeam.complaint_count],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-weak)', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 16, color: 'var(--primary)', fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="section-label" style={{ marginBottom: 8 }}>Routed Complaints</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedTeam.sample_complaints.map((complaint) => (
                      <button
                        key={complaint.complaint_id}
                        onClick={() => setSelectedComplaintId(complaint.complaint_id)}
                        style={{
                          textAlign: 'left',
                          background: selectedComplaintId === complaint.complaint_id ? 'var(--panel-hover)' : 'transparent',
                          border: `1px solid ${selectedComplaintId === complaint.complaint_id ? 'var(--accent)' : 'var(--border)'}`,
                          padding: '10px 12px',
                          color: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 10, color: 'var(--primary)' }}>{complaint.product ?? 'Unknown'} · {complaint.issue ?? 'Complaint'}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{complaint.customer_state ?? '—'}</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--secondary)' }}>
                          {complaint.needs_human_review ? 'Needs review' : 'Auto clear'} · Criticality {complaint.criticality_score ?? 0}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Loading internal team metrics…</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Customer Context</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{selectedDetail?.customer_profile?.customer_id ?? '—'}</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedDetail?.customer_profile ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Customer', selectedDetail.customer_profile.full_name],
                    ['Segment', selectedDetail.customer_profile.segment],
                    ['Credit Score', selectedDetail.customer_profile.credit_score],
                    ['Delinquency', `${selectedDetail.customer_profile.delinquency_days} days`],
                    ['Default Probability', formatPct(selectedDetail.customer_profile.default_probability)],
                    ['Previous Complaints', selectedDetail.customer_profile.previous_complaints_count],
                    ['Open Products', selectedDetail.customer_profile.open_products.join(', ')],
                    ['Relationship Value', `$${selectedDetail.customer_profile.relationship_value_usd.toLocaleString()}`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-weak)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 10, color: 'var(--primary)', lineHeight: 1.6 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>
                  Account overview: deposit balance ${selectedDetail.customer_profile.deposit_balance_usd.toLocaleString()},
                  revolving balance ${selectedDetail.customer_profile.revolving_balance_usd.toLocaleString()},
                  loan balance ${selectedDetail.customer_profile.loan_balance_usd.toLocaleString()},
                  utilization {formatPct(selectedDetail.customer_profile.credit_utilization_ratio)}.
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Select a routed complaint to load the customer dossier.</div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Complaint Flow</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{selectedDetail?.complaint_id ?? '—'}</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedDetail ? (
              <>
                <div style={{ fontSize: 10, color: 'var(--primary)' }}>
                  {selectedDetail.routing?.because ?? selectedDetail.routing?.reasoning ?? 'Routing rationale unavailable.'}
                </div>
                {[
                  ['Ticket', selectedDetail.ticket?.ticket_id],
                  ['Root Cause', selectedDetail.root_cause?.label],
                  ['Primary Team', selectedDetail.internal_teams?.primary_team?.team_name],
                  ['Priority', selectedDetail.routing?.priority],
                  ['SLA', selectedDetail.routing?.sla_hours ? `${selectedDetail.routing.sla_hours}h` : null],
                  ['Review Gate', selectedDetail.review_gate?.needs_human_review ? 'Needs Human Review' : 'Auto Clear'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{label}</span>
                    <span style={{ fontSize: 10, color: 'var(--primary)' }}>{value ?? '—'}</span>
                  </div>
                ))}

                <div>
                  <div className="section-label" style={{ marginBottom: 8 }}>Handoffs</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(selectedDetail.internal_teams?.handoffs ?? []).map((handoff) => (
                      <div key={`${handoff.team_code}-${handoff.team_name}`} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--primary)', marginBottom: 4 }}>{handoff.team_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>{handoff.handoff_reason}</div>
                      </div>
                    ))}
                    {!selectedDetail.internal_teams?.handoffs?.length && (
                      <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>No secondary handoffs for this complaint.</div>
                    )}
                  </div>
                </div>
                {selectedDetail.customer_profile?.customer_id && (
                  <button className="btn btn-ghost" onClick={() => navigate('/lookup')} style={{ fontSize: 10, alignSelf: 'flex-start' }}>
                    Open Look-up →
                  </button>
                )}
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Select a routed complaint to inspect the internal-team flow.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
