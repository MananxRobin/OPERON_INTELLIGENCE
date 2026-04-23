import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';

import StateHeatmap from '../components/charts/StateHeatmap';
import { ACCENT, PALETTE } from '../constants';
import { api } from '../services/api';
import type { SynopsisOverviewResponse } from '../store';

type Period = '7D' | '1M' | '3M';

const PERIOD_DAYS: Record<Period, number> = { '7D': 7, '1M': 30, '3M': 90 };

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

function formatLastSync(value: string | null | undefined) {
  if (!value) return 'waiting for first cache sync';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('1M');
  const [payload, setPayload] = useState<SynopsisOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.synopsisCfpb(PERIOD_DAYS[period], 8);
        if (!cancelled) {
          setPayload(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load cached CFPB synopsis data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    load();
    const poll = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [period]);

  const stats = payload?.kpis;
  const stateMap = payload?.geographic_distribution ?? {};
  const hasData = (stats?.total_processed ?? 0) > 0;
  const overviewText = useMemo(() => {
    if (error) return 'Synopsis only reads the persisted CFPB cache. Live cache refresh is currently unavailable.';
    if (!payload) return 'Loading persisted CFPB cache...';
    if (!hasData) return 'The CFPB cache is online but there are no persisted complaints in this window yet.';
    return `${payload.meta.total_cached.toLocaleString()} cached CFPB complaints available locally. Synopsis refreshes from the live CFPB feed every minute.`;
  }, [error, payload, hasData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
            Synopsis
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            Live CFPB complaint intelligence backed by a separate local cache database
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>
            Last CFPB cache sync: {formatLastSync(payload?.meta.last_cached_at)}
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
          <button className="btn btn-ghost" style={{ fontSize: 9, padding: '5px 10px' }} onClick={() => navigate('/analysis')}>
            Analysis
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 9, padding: '5px 10px' }} onClick={() => navigate('/explorer')}>
            Explorer
          </button>
        </div>
      </div>

      <div className="panel">
        <div style={{ padding: '14px 18px', fontSize: 11, color: error ? 'var(--accent)' : 'var(--secondary)', lineHeight: 1.7 }}>
          {overviewText}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          {
            label: 'Total Processed',
            value: payload?.meta.total_cached?.toLocaleString() ?? '0',
            sub: `${stats?.total_processed ?? 0} in ${payload?.meta.days ?? PERIOD_DAYS[period]} day window`,
          },
          {
            label: 'Auto Resolution',
            value: `${Math.round(stats?.auto_resolution_rate ?? 0)}%`,
            sub: `${stats?.auto_resolution_count ?? 0} closed company responses`,
          },
          {
            label: 'Avg Resolution',
            value: stats?.avg_resolution_days == null ? '--' : `${stats.avg_resolution_days.toFixed(1)}d`,
            sub: 'derived from public CFPB timing fields',
          },
          {
            label: 'Response Friction',
            value: `${Math.round(stats?.response_friction_rate ?? 0)}%`,
            sub: `${stats?.response_friction_count ?? 0} disputed, untimely, or in-progress`,
            accent: true,
          },
        ].map((card) => (
          <div key={card.label} className="stat-card" style={{ padding: '16px 16px 14px' }}>
            <div className="stat-card__label">{card.label}</div>
            <div
              className="stat-card__value"
              style={{ fontSize: 22, color: card.accent ? 'var(--accent)' : 'var(--primary)' }}
            >
              {loading ? '...' : card.value}
            </div>
            <div className="stat-card__sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Complaint Volume</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{period}</span>
          </div>
          <div style={{ padding: '14px 18px 10px' }}>
            <AreaChart width={520} height={170} data={payload?.complaint_volume ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="synopsisVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="count" name="Complaints" stroke={ACCENT} fill="url(#synopsisVolume)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Response Friction</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(payload?.response_friction ?? []).map((entry, index) => (
              <div key={entry.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--secondary)' }}>{entry.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--primary)' }}>{entry.value}</span>
                </div>
                <div className="hbar-track">
                  <div
                    className="hbar-fill"
                    style={{
                      width: `${Math.min(100, (entry.value / Math.max(1, stats?.total_processed ?? 1)) * 100)}%`,
                      background: PALETTE[index] ?? 'var(--muted-3)',
                    }}
                  />
                </div>
              </div>
            ))}
            {!hasData ? (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                No cached CFPB complaints available in this period yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}>
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
            {(payload?.by_product ?? []).map((product, index) => (
              <div key={product.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                    {product.name}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)' }}>{product.value}</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(product.value / (payload?.by_product[0]?.value || 1)) * 100}%`, background: PALETTE[index] ?? 'var(--muted-3)' }} />
                </div>
              </div>
            ))}
            {!hasData ? (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                Waiting for cached CFPB product data.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Top Institutions</span>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(payload?.top_institutions ?? []).map((company, index) => (
              <div key={company.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                    {company.name}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>{company.value}</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(company.value / (payload?.top_institutions[0]?.value || 1)) * 100}%`, background: index === 0 ? 'var(--accent)' : 'var(--text-faint)' }} />
                </div>
              </div>
            ))}
            {!hasData ? (
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                Waiting for cached CFPB institution data.
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Live Complaints Snapshot</span>
            <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 8px' }} onClick={() => navigate('/explorer')}>
              Open Explorer
            </button>
          </div>
          <div style={{ overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Institution</th>
                  <th>State</th>
                  <th>Response</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.live_snapshot ?? []).map((row) => (
                  <tr key={row.complaint_id}>
                    <td style={{ color: 'var(--text-mid)', fontVariantNumeric: 'tabular-nums' }}>{row.date_received ?? '--'}</td>
                    <td style={{ color: 'var(--primary)' }}>{row.product ?? '--'}</td>
                    <td style={{ color: 'var(--secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.company ?? '--'}</td>
                    <td style={{ color: 'var(--text-weak)' }}>{row.state ?? '--'}</td>
                    <td style={{ color: (row.company_response || '').toLowerCase().startsWith('closed') ? 'var(--success)' : 'var(--text-mid)' }}>
                      {row.company_response ?? '--'}
                    </td>
                  </tr>
                ))}
                {!hasData ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px', color: 'var(--text-faint)', textAlign: 'center' }}>
                      No cached CFPB complaints are available for this window yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
