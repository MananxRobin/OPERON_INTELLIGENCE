import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';

import { ACCENT, PALETTE } from '../constants';
import StateHeatmap from '../components/charts/StateHeatmap';
import { useCfpbData } from '../hooks/useCfpbData';
import { daysAgo } from '../services/api';
import { useStore } from '../store';

type Period = '7D' | '1M' | '3M';

const PERIOD_DAYS: Record<Period, number> = { '7D': 7, '1M': 30, '3M': 90 };

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="chart-tooltip">
      <div style={{ color: 'var(--text-weak)', fontSize: 10, marginBottom: 4 }}>{label}</div>
      {payload.map((entry: any, index: number) => (
        <div key={index} style={{ color: entry.color ?? 'var(--primary)', fontWeight: 600 }}>{entry.name}: {entry.value}</div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const stats = useStore((state) => state.backendStats);
  const trends = useStore((state) => state.backendTrends);
  const complaints = useStore((state) => state.processedComplaints);
  const connected = useStore((state) => state.backendConnected);
  const [period, setPeriod] = useState<Period>('1M');

  const { rows, total, loading, synthetic } = useCfpbData({
    size: 250,
    date_received_min: daysAgo(PERIOD_DAYS[period]),
  });

  const recentReviewQueue = useMemo(
    () => complaints.filter((complaint) => complaint.needs_human_review).slice(0, 6),
    [complaints]
  );

  const cfpbSummary = useMemo(() => {
    const critical = rows.filter((row) => row.risk === 'CRITICAL').length;
    const high = rows.filter((row) => row.risk === 'HIGH').length;
    const states = new Set(rows.map((row) => row.state).filter(Boolean)).size;
    return { critical, high, states };
  }, [rows]);

  const stateMap = useMemo(
    () => rows.reduce((map, row) => {
      if (row.state) map[row.state] = (map[row.state] || 0) + 1;
      return map;
    }, {} as Record<string, number>),
    [rows]
  );

  const productData = useMemo(
    () => Object.entries(rows.reduce((map, row) => {
      map[row.product] = (map[row.product] || 0) + 1;
      return map;
    }, {} as Record<string, number>))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value })),
    [rows]
  );

  const companyData = useMemo(
    () => Object.entries(rows.reduce((map, row) => {
      if (!map[row.company]) map[row.company] = { total: 0, critical: 0 };
      map[row.company].total++;
      if (row.risk === 'CRITICAL') map[row.company].critical++;
      return map;
    }, {} as Record<string, { total: number; critical: number }>))
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, value]) => ({ name: name.slice(0, 24), total: value.total, critical: value.critical })),
    [rows]
  );

  const reviewQueueDisplay = useMemo(() => {
    if (recentReviewQueue.length > 0) {
      return recentReviewQueue.map((complaint) => ({
        id: complaint.complaint_id,
        title: `${complaint.product} · ${complaint.issue}`,
        detail: complaint.review_reason_codes.map((reason) => reason.replaceAll('_', ' ').toLowerCase()).join(' · '),
        risk: complaint.risk_level ?? 'HIGH',
        criticality: complaint.criticality_score ?? 0,
        link: `/complaints/${complaint.complaint_id}`,
      }));
    }

    return rows
      .filter((row) => row.risk === 'CRITICAL' || row.disputed || row.untimely)
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        title: `${row.product} · ${row.issue}`,
        detail: [row.disputed ? 'consumer disputed' : null, row.untimely ? 'untimely response' : null, row.source.replaceAll('_', ' ')].filter(Boolean).join(' · '),
        risk: row.risk,
        criticality: row.risk === 'CRITICAL' ? 82 : 64,
        link: '/live',
      }));
  }, [recentReviewQueue, rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Command Center</h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            Explainable complaint ops with CFPB pulse, supervisor queues, and baseline workflow deltas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['7D', '1M', '3M'] as Period[]).map((value) => (
            <button
              key={value}
              className="btn btn-ghost"
              onClick={() => setPeriod(value)}
              style={{
                fontSize: 9,
                padding: '5px 10px',
                borderColor: period === value ? 'var(--accent)' : 'var(--border)',
                color: period === value ? 'var(--accent)' : 'var(--secondary)',
                background: period === value ? 'var(--highlight)' : 'transparent',
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
        {[
          { label: 'Total Processed', value: stats?.total_complaints ?? 0, sub: `${stats?.complaints_today ?? 0} today` },
          { label: 'Needs Human Review', value: stats?.needs_human_review_count ?? 0, sub: 'supervisor queue', accent: true },
          { label: 'High Regulatory Risk', value: stats?.high_regulatory_risk_count ?? 0, sub: 'critical or high' },
          { label: 'SLA Breach Risk', value: stats?.sla_breach_risk_count ?? 0, sub: 'timeliness exposure' },
          { label: 'Compliance Flags', value: stats?.compliance_flags_caught ?? 0, sub: `${stats?.critical_risk_count ?? 0} critical` },
          { label: 'Auto Resolution', value: `${(stats?.auto_resolution_rate ?? 0).toFixed(0)}%`, sub: `${(stats?.timely_response_rate ?? 0).toFixed(0)}% timely` },
          { label: 'Avg Resolution', value: `${(stats?.avg_resolution_time_hrs ?? 0).toFixed(1)}h`, sub: connected ? 'live backend' : 'synthetic demo' },
        ].map((card) => (
          <div key={card.label} className="stat-card" style={{ padding: '16px 16px 14px' }}>
            <div className="stat-card__label">{card.label}</div>
            <div className="stat-card__value" style={{ fontSize: 22, color: card.accent ? 'var(--accent)' : 'var(--primary)' }}>{card.value}</div>
            <div className="stat-card__sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.9fr 0.9fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Complaint Volume</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{period}</span>
          </div>
          <div style={{ padding: '14px 18px 10px' }}>
            <AreaChart width={460} height={160} data={trends?.complaints_over_time ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="dashboardVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="count" name="Complaints" stroke={ACCENT} fill="url(#dashboardVolume)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Criticality Composition</span>
          </div>
          <div style={{ padding: '14px 18px 10px' }}>
            <BarChart width={250} height={160} data={trends?.criticality_breakdown ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
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

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">AI vs Baseline</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-weak)', lineHeight: 1.6 }}>
              Divergent cases are the best demo moments: they show where the agent pipeline improves on a rules-only workflow.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Supervisor Queue</span>
            <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 8px' }} onClick={() => navigate('/explorer')}>
              Open Triage
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {reviewQueueDisplay.length === 0 ? (
              <div style={{ padding: '22px 18px', color: 'var(--text-faint)', fontSize: 11 }}>No queued complaints yet.</div>
            ) : (
              reviewQueueDisplay.map((complaint) => (
                <button
                  key={complaint.id}
                  onClick={() => navigate(complaint.link)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    width: '100%',
                    padding: '12px 18px',
                    background: 'transparent',
                    border: 'none',
                    borderTop: '1px solid var(--border)',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 4 }}>
                      {complaint.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>
                      {complaint.detail}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: complaint.risk === 'CRITICAL' ? 'var(--accent)' : 'var(--secondary)' }}>{complaint.risk}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>C {complaint.criticality}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">CFPB Pulse</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{synthetic ? 'synthetic fallback' : 'live proxy'}</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { label: 'In Window', value: rows.length },
              { label: 'Critical', value: cfpbSummary.critical },
              { label: 'High Risk', value: cfpbSummary.high },
              { label: 'States', value: cfpbSummary.states },
            ].map((card) => (
              <div key={card.label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '12px 14px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 20, color: card.label === 'Critical' ? 'var(--accent)' : 'var(--primary)', fontWeight: 600 }}>{card.value}</div>
              </div>
            ))}
            <div style={{ gridColumn: 'span 2', paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>
              {loading ? 'Refreshing CFPB window…' : `${total.toLocaleString()} records available in ${period} window. Use Live Feed for source-level drilldown and scheduling.`}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Geographic Distribution</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{Object.keys(stateMap).length} states</span>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <StateHeatmap data={stateMap} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">By Product</span>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {productData.map((product, index) => (
              <div key={product.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{product.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)' }}>{product.value}</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(product.value / (productData[0]?.value || 1)) * 100}%`, background: PALETTE[index] ?? 'var(--muted-3)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Top Institutions</span>
            <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 8px' }} onClick={() => navigate('/institutions')}>
              Monitor
            </button>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {companyData.map((company, index) => (
              <div key={company.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{company.name}</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 9, color: company.critical > 0 ? 'var(--accent)' : 'var(--text-faint)' }}>{company.critical} critical</span>
                    <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>{company.total}</span>
                  </div>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(company.total / (companyData[0]?.total || 1)) * 100}%`, background: index === 0 ? 'var(--accent)' : 'var(--text-faint)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Live Complaints Snapshot</span>
            <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 8px' }} onClick={() => navigate('/live')}>
              Open Feed
            </button>
          </div>
          <div style={{ overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Issue</th>
                  <th>State</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row) => (
                  <tr key={row.id}>
                    <td style={{ color: 'var(--text-mid)', fontVariantNumeric: 'tabular-nums' }}>{row.date}</td>
                    <td style={{ color: 'var(--primary)' }}>{row.product}</td>
                    <td style={{ color: 'var(--secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.issue}</td>
                    <td style={{ color: 'var(--text-weak)' }}>{row.state}</td>
                    <td style={{ color: row.risk === 'CRITICAL' ? 'var(--accent)' : row.risk === 'HIGH' ? 'var(--secondary)' : 'var(--text-weak)' }}>{row.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
