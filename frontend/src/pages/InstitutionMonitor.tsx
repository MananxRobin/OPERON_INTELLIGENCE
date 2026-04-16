import { useState, useMemo } from 'react';
import { useCfpbData } from '../hooks/useCfpbData';
import { daysAgo } from '../services/api';
import { ACCENT, PALETTE } from '../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

type Window = '30D' | '90D' | '180D';
const WINDOW_DAYS: Record<Window, number> = { '30D': 30, '90D': 90, '180D': 180 };

interface Institution {
  name: string;
  total: number;
  critical: number;
  high: number;
  disputed: number;
  untimely: number;
  products: string[];
  states: string[];
  disputeRate: number;
  riskScore: number;
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="chart-tooltip">
      <div style={{ color: 'var(--text-weak)', fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--primary)', fontWeight: 600 }}>{payload[0].value}</div>
    </div>
  );
}

function WindowBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', fontSize: 9, border: '1px solid',
        borderColor: active ? ACCENT : 'var(--border)',
        background: active ? 'rgba(232,67,58,0.08)' : 'transparent',
        color: active ? ACCENT : 'var(--text-mid)',
        borderRadius: 2, cursor: 'pointer', fontWeight: active ? 600 : 400,
        letterSpacing: '0.06em',
      }}
    >
      {label}
    </button>
  );
}

function riskLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'CRITICAL', color: ACCENT };
  if (score >= 45) return { label: 'HIGH',     color: 'var(--secondary)' };
  if (score >= 20) return { label: 'MEDIUM',   color: 'var(--text-weak)' };
  return                   { label: 'LOW',      color: 'var(--text-faint)' };
}

export default function InstitutionMonitor() {
  const [window_,    setWindow]  = useState<Window>('30D');
  const [selected,   setSelected] = useState<string | null>(null);
  const [sortBy,     setSortBy]   = useState<'total' | 'riskScore' | 'disputeRate'>('total');

  const { rows, total, loading, synthetic: error } = useCfpbData({
    size: 250,
    date_received_min: daysAgo(WINDOW_DAYS[window_]),
  });

  const institutions = useMemo<Institution[]>(() => {
    const map: Record<string, {
      total: number; critical: number; high: number; disputed: number; untimely: number;
      products: Set<string>; states: Set<string>;
    }> = {};

    for (const r of rows) {
      const name = r.company;
      if (!map[name]) map[name] = { total: 0, critical: 0, high: 0, disputed: 0, untimely: 0, products: new Set(), states: new Set() };
      const e = map[name];
      e.total++;
      if (r.risk === 'CRITICAL') e.critical++;
      else if (r.risk === 'HIGH') e.high++;
      if (r.disputed) e.disputed++;
      if (r.untimely) e.untimely++;
      if (r.product) e.products.add(r.product);
      if (r.state)   e.states.add(r.state);
    }

    return Object.entries(map).map(([name, d]) => {
      const disputeRate = d.total > 0 ? Math.round((d.disputed / d.total) * 100) : 0;
      const critRate    = d.total > 0 ? (d.critical / d.total) * 100 : 0;
      const untimeRate  = d.total > 0 ? (d.untimely / d.total) * 100 : 0;
      const riskScore   = Math.min(100, Math.round(critRate * 0.5 + untimeRate * 0.3 + disputeRate * 0.2));
      return {
        name, total: d.total, critical: d.critical, high: d.high,
        disputed: d.disputed, untimely: d.untimely,
        products: Array.from(d.products),
        states:   Array.from(d.states),
        disputeRate, riskScore,
      };
    });
  }, [rows]);

  const sorted = [...institutions].sort((a, b) => b[sortBy] - a[sortBy]);
  const topChart = sorted.slice(0, 10);
  const selectedInst = selected ? institutions.find(i => i.name === selected) : null;
  const totalComplaints = institutions.reduce((s, i) => s + i.total, 0);
  const highRiskInsts = institutions.filter(i => i.riskScore >= 45).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Institution Monitor</h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            Company-level risk profiles · complaint volume · dispute rates · CFPB live data
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading && <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>Loading…</span>}
          {error   && <span style={{ fontSize: 10, color: ACCENT }}>CFPB unavailable</span>}
          {!loading && !error && <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>{total.toLocaleString()} total records</span>}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['30D', '90D', '180D'] as Window[]).map(w => (
              <WindowBtn key={w} label={w} active={window_ === w} onClick={() => setWindow(w)} />
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Institutions Tracked', value: institutions.length },
          { label: 'High Risk Institutions', value: highRiskInsts },
          { label: 'Total Complaints', value: totalComplaints },
          { label: 'Disputed', value: institutions.reduce((s, i) => s + i.disputed, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div className="stat-card__label">{label}</div>
            <div className="stat-card__value" style={{ color: label === 'High Risk Institutions' && value > 0 ? ACCENT : 'var(--primary)' }}>
              {value}
            </div>
            <div className="stat-card__sub">{window_} window</div>
          </div>
        ))}
      </div>

      {/* Volume bar chart */}
      <div className="panel">
        <div className="panel-header">
          <span className="section-label">Top 10 Institutions by Complaint Volume</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['total', 'riskScore', 'disputeRate'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                style={{
                  padding: '3px 8px', fontSize: 9, border: '1px solid',
                  borderColor: sortBy === s ? ACCENT : 'var(--border)',
                  background: sortBy === s ? 'rgba(232,67,58,0.08)' : 'transparent',
                  color: sortBy === s ? ACCENT : 'var(--text-mid)',
                  borderRadius: 2, cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >
                {s === 'total' ? 'Volume' : s === 'riskScore' ? 'Risk Score' : 'Dispute Rate'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 18px 12px' }}>
          {topChart.length > 0 ? (
            <BarChart
              width={820} height={160}
              data={topChart.map(i => ({ name: i.name.slice(0, 22), value: i[sortBy] }))}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'var(--text-mid)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-mid)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" radius={[1, 1, 0, 0]}>
                {topChart.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? ACCENT : PALETTE[Math.min(i, PALETTE.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{loading ? 'Fetching…' : 'No data'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Institution table + detail panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, alignItems: 'start' }}>
        {/* Table */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Institution Risk Table</span>
            <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>{sorted.length} institutions</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Institution</th>
                <th style={{ width: 60 }}>Total</th>
                <th style={{ width: 60 }}>Critical</th>
                <th style={{ width: 70 }}>Dispute %</th>
                <th style={{ width: 80 }}>Risk Score</th>
                <th style={{ width: 70 }}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 40).map((inst, i) => {
                const { label, color } = riskLabel(inst.riskScore);
                const isSelected = selected === inst.name;
                return (
                  <tr
                    key={inst.name}
                    onClick={() => setSelected(isSelected ? null : inst.name)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'var(--panel-hover)' : undefined,
                      borderLeft: isSelected ? `2px solid ${ACCENT}` : '2px solid transparent',
                    }}
                  >
                    <td style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                    <td style={{ color: 'var(--primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inst.name}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--secondary)' }}>{inst.total}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: inst.critical > 0 ? ACCENT : 'var(--text-mid)' }}>{inst.critical}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: inst.disputeRate > 20 ? ACCENT : 'var(--text-weak)' }}>
                      {inst.disputeRate}%
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: color }}>{inst.riskScore}</td>
                    <td><span className={`badge ${label === 'CRITICAL' ? 'badge-red' : 'badge-dim'}`}>{label}</span></td>
                  </tr>
                );
              })}
              {sorted.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-faint)' }}>
                    No data in selected window
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        <div style={{ position: 'sticky', top: 0 }}>
          {selectedInst ? (
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 4, lineHeight: 1.4 }}>
                  {selectedInst.name}
                </div>
                <span className={`badge ${riskLabel(selectedInst.riskScore).label === 'CRITICAL' ? 'badge-red' : 'badge-dim'}`}>
                  {riskLabel(selectedInst.riskScore).label}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  ['Risk Score',    `${selectedInst.riskScore}/100`],
                  ['Total',         selectedInst.total],
                  ['Critical',      selectedInst.critical],
                  ['High',          selectedInst.high],
                  ['Disputed',      `${selectedInst.disputed} (${selectedInst.disputeRate}%)`],
                  ['Untimely',      selectedInst.untimely],
                  ['Products',      selectedInst.products.length],
                  ['States',        selectedInst.states.length],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>{k}</span>
                    <span style={{ fontSize: 10, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{String(v)}</span>
                  </div>
                ))}
              </div>

              {selectedInst.products.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Products</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {selectedInst.products.slice(0, 6).map(p => (
                      <span key={p} className="badge badge-dim" style={{ fontSize: 8 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedInst.states.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>States</div>
                  <div style={{ fontSize: 10, color: 'var(--text-weak)' }}>{selectedInst.states.slice(0, 12).join(', ')}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-faint)', fontSize: 11 }}>
                Click an institution<br />to view details
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
