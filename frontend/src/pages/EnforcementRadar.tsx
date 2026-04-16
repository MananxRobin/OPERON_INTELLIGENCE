import { useState } from 'react';
import { useCfpbData } from '../hooks/useCfpbData';
import { daysAgo } from '../services/api';
import { ACCENT, PALETTE } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';

type Window = '7D' | '30D' | '90D';
const WINDOW_DAYS: Record<Window, number> = { '7D': 7, '30D': 30, '90D': 90 };

interface EnfRow {
  id: string;
  date: string;
  company: string;
  product: string;
  issue: string;
  state: string;
  response: string;
  disputed: boolean;
  untimely: boolean;
  severity: 'CRITICAL' | 'HIGH';
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

export default function EnforcementRadar() {
  const [window_, setWindow] = useState<Window>('30D');

  const { rows: allRows, total, loading, synthetic: error } = useCfpbData({
    size: 250,
    date_received_min: daysAgo(WINDOW_DAYS[window_]),
  });

  // Filter to only CRITICAL / HIGH rows
  const rows: EnfRow[] = allRows
    .filter(r => r.risk === 'CRITICAL' || r.risk === 'HIGH')
    .map(r => ({
      id:       r.id,
      date:     r.date,
      company:  r.company,
      product:  r.product,
      issue:    r.issue,
      state:    r.state,
      response: r.untimely ? 'Untimely response' : r.disputed ? 'Closed - disputed' : 'In progress',
      disputed: r.disputed,
      untimely: r.untimely,
      severity: r.risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    }));

  // ── Derived ───────────────────────────────────────────────────────────────
  const volMap: Record<string, number> = {};
  rows.forEach(r => { volMap[r.date] = (volMap[r.date] || 0) + 1; });
  const volumeData = Object.entries(volMap).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), count }));

  const companyMap: Record<string, { count: number; critical: number }> = {};
  rows.forEach(r => {
    if (!companyMap[r.company]) companyMap[r.company] = { count: 0, critical: 0 };
    companyMap[r.company].count++;
    if (r.severity === 'CRITICAL') companyMap[r.company].critical++;
  });
  const topCompanies = Object.entries(companyMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, d]) => ({ name: name.slice(0, 30), ...d }));
  const maxComp = topCompanies[0]?.count || 1;

  const critical  = rows.filter(r => r.severity === 'CRITICAL').length;
  const high      = rows.filter(r => r.severity === 'HIGH').length;
  const disputed  = rows.filter(r => r.disputed).length;
  const untimely  = rows.filter(r => r.untimely).length;

  const productMap: Record<string, number> = {};
  rows.forEach(r => { productMap[r.product] = (productMap[r.product] || 0) + 1; });
  const productData = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Enforcement Radar</h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            Untimely responses · disputed complaints · regulatory risk signals · CFPB live data
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading && <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>Loading…</span>}
          {error   && <span style={{ fontSize: 10, color: ACCENT }}>CFPB unavailable</span>}
          {!loading && !error && <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>{total.toLocaleString()} total in range</span>}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['7D', '30D', '90D'] as Window[]).map(w => (
              <WindowBtn key={w} label={w} active={window_ === w} onClick={() => setWindow(w)} />
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Enforcement Actions', value: rows.length, sub: `${window_} window` },
          { label: 'Critical Risk',       value: critical,    sub: 'untimely + disputed' },
          { label: 'High Risk',           value: high,        sub: 'untimely responses' },
          { label: 'Disputed',            value: disputed,    sub: 'consumer escalations' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="stat-card">
            <div className="stat-card__label">{label}</div>
            <div className="stat-card__value" style={{ color: label === 'Critical Risk' && value > 0 ? ACCENT : 'var(--primary)' }}>
              {value}
            </div>
            <div className="stat-card__sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Timeline + Institution bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Enforcement Action Timeline</span>
            <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>{rows.length} actions</span>
          </div>
          <div style={{ padding: '16px 18px 12px' }}>
            {volumeData.length > 0 ? (
              <AreaChart width={560} height={150} data={volumeData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="enfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={ACCENT} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-mid)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-mid)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="count" stroke={ACCENT} fill="url(#enfGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            ) : (
              <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{loading ? 'Fetching…' : 'No actions in range'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span className="section-label">By Product</span></div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {productData.length > 0 ? productData.map((p, i) => (
              <div key={p.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{p.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(p.value / (productData[0]?.value || 1)) * 100}%`, background: PALETTE[i] ?? '#222' }} />
                </div>
              </div>
            )) : (
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{loading ? 'Loading…' : 'No data'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Top institutions */}
      <div className="panel">
        <div className="panel-header">
          <span className="section-label">Top Institutions by Enforcement Actions</span>
          <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>{topCompanies.length} institutions</span>
        </div>
        <div style={{ padding: '14px 18px' }}>
          {topCompanies.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topCompanies.map((c, i) => (
                <div key={c.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', minWidth: 14 }}>{i + 1}</span>
                      <span style={{ fontSize: 11, color: 'var(--secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexShrink: 0, marginLeft: 12 }}>
                      <span style={{ fontSize: 9, color: c.critical > 0 ? ACCENT : 'var(--text-mid)', fontVariantNumeric: 'tabular-nums' }}>
                        {c.critical} critical
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
                    </div>
                  </div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${(c.count / maxComp) * 100}%`, background: i === 0 ? ACCENT : 'var(--text-faint)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 11 }}>
              {loading ? 'Loading institutions…' : 'No enforcement actions in selected window'}
            </div>
          )}
        </div>
      </div>

      {/* Action log */}
      <div className="panel">
        <div className="panel-header">
          <span className="section-label">Enforcement Action Log</span>
          <span style={{ fontSize: 10, color: 'var(--text-mid)' }}>{rows.length} records · {window_} window</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Date</th>
              <th>Institution</th>
              <th>Product</th>
              <th>Issue</th>
              <th style={{ width: 40 }}>State</th>
              <th style={{ width: 70 }}>Severity</th>
              <th style={{ width: 70 }}>Disputed</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((r, i) => (
              <tr key={`${r.id}-${i}`}>
                <td style={{ color: 'var(--text-mid)', fontVariantNumeric: 'tabular-nums' }}>{r.date}</td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--primary)' }}>{r.company}</td>
                <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.issue}</td>
                <td style={{ color: 'var(--secondary)' }}>{r.state}</td>
                <td>
                  <span className={`badge ${r.severity === 'CRITICAL' ? 'badge-red' : 'badge-dim'}`}>{r.severity}</span>
                </td>
                <td style={{ color: r.disputed ? ACCENT : 'var(--text-faint)' }}>{r.disputed ? 'YES' : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-faint)' }}>
                  No enforcement actions in selected window
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
