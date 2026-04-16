import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';

import { api } from '../services/api';
import { useCfpbData } from '../hooks/useCfpbData';
import type { ScheduleDefinition, ScheduleRun, SyntheticCfpbRow } from '../store';

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

function ComplaintDrawer({ row, onClose }: { row: SyntheticCfpbRow; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--overlay)', display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        style={{ width: 430, height: '100%', background: 'var(--bg-1)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-weak)', textTransform: 'uppercase' }}>Complaint</div>
            <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>#{row.id}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 10, padding: '5px 10px' }}>Close</button>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: row.risk === 'CRITICAL' ? 'var(--accent)' : row.risk === 'HIGH' ? 'var(--secondary)' : 'var(--text-weak)', display: 'block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: row.risk === 'CRITICAL' ? 'var(--accent)' : 'var(--secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {row.risk} Risk
            </span>
            <span className="badge badge-gray">{row.source.replaceAll('_', ' ')}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {[
            ['Date Received', row.date],
            ['Product', row.product],
            ['Issue', row.issue || '—'],
            ['Institution', row.company],
            ['State', row.state || '—'],
            ['Channel', row.channel || '—'],
            ['Company Response', row.company_response || '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-weak)', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--primary)', lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}
          <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-weak)', textTransform: 'uppercase', marginBottom: 5 }}>Narrative</div>
            <div style={{ fontSize: 11, color: 'var(--secondary)', lineHeight: 1.7 }}>{row.narrative || 'Narrative unavailable from source.'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveFeed() {
  const [refreshTick, setRefreshTick] = useState(0);
  const [selected, setSelected] = useState<SyntheticCfpbRow | null>(null);
  const [schedules, setSchedules] = useState<ScheduleDefinition[]>([]);
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const { rows: complaints, total, loading, synthetic } = useCfpbData({ size: 100, refreshTick });

  const loadSchedules = async () => {
    try {
      const response = await api.schedules();
      const liveSchedules = response.schedules.filter((schedule) => schedule.mode === 'live');
      setSchedules(liveSchedules);
      setRuns(liveSchedules.flatMap((schedule) => schedule.runs ?? []).slice(0, 8));
      setScheduleError(null);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Could not load schedules');
    }
  };

  useEffect(() => {
    void loadSchedules();
    const timer = window.setInterval(() => { void loadSchedules(); }, 20_000);
    return () => window.clearInterval(timer);
  }, []);

  const volumeData = useMemo(
    () => Object.entries(complaints.reduce((map, complaint) => {
      map[complaint.date] = (map[complaint.date] || 0) + 1;
      return map;
    }, {} as Record<string, number>))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, count]) => ({ date, count })),
    [complaints]
  );

  const sourceBreakdown = useMemo(
    () => Object.entries(complaints.reduce((map, complaint) => {
      map[complaint.source] = (map[complaint.source] || 0) + 1;
      return map;
    }, {} as Record<string, number>)).map(([name, value]) => ({ name: name.replaceAll('_', ' '), value })),
    [complaints]
  );

  const riskBreakdown = useMemo(
    () => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => ({ name: level, value: complaints.filter((complaint) => complaint.risk === level).length })),
    [complaints]
  );

  const createLiveSchedule = async (cadence: 'live_1m' | 'live_5m' | 'live_15m' | 'live_60m') => {
    try {
      await api.createSchedule({
        name: `Live ${cadence.replace('live_', '').replace('m', 'm poll')}`,
        mode: 'live',
        cadence,
        source_type: 'cfpb_live',
        payload: { size: 50, filters: {} },
        status: 'active',
      });
      await loadSchedules();
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Could not create live schedule');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {selected && <ComplaintDrawer row={selected} onClose={() => setSelected(null)} />}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Live Feed</h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            CFPB live stream, provenance tracking, and scheduled polling controls
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--text-faint)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: synthetic ? 'var(--accent)' : 'var(--success)', display: 'block', animation: 'pulse-ring 1.8s ease-out infinite' }} />
            {synthetic ? 'SYNTHETIC FALLBACK' : 'LIVE CFPB'}
          </span>
          {loading && <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>Fetching…</span>}
          <button className="btn btn-ghost" onClick={() => setRefreshTick((value) => value + 1)} style={{ fontSize: 10 }}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Live Scheduling</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{schedules.length} active definitions</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['live_1m', '1m'],
                ['live_5m', '5m'],
                ['live_15m', '15m'],
                ['live_60m', '60m'],
              ] as const).map(([cadence, label]) => (
                <button key={cadence} className="btn btn-ghost" style={{ fontSize: 9, padding: '5px 10px' }} onClick={() => void createLiveSchedule(cadence)}>
                  Add {label}
                </button>
              ))}
            </div>

            {scheduleError && <div style={{ fontSize: 10, color: 'var(--accent)' }}>{scheduleError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {schedules.length === 0 ? (
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>No live schedules yet. Add a cadence above for demo polling.</div>
              ) : (
                schedules.map((schedule) => (
                  <div key={schedule.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--primary)' }}>{schedule.name}</span>
                      <span className={`badge ${schedule.status === 'active' ? 'badge-gray' : 'badge-red'}`}>{schedule.status}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--secondary)', marginBottom: 8 }}>
                      Next run: {schedule.next_run_at ? schedule.next_run_at.replace('T', ' ').slice(0, 16) : 'manual only'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 10px' }} onClick={() => void api.runSchedule(schedule.id).then(loadSchedules)}>
                        Run Now
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 10px' }} onClick={() => void api.pauseSchedule(schedule.id, schedule.status === 'active').then(loadSchedules)}>
                        {schedule.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="section-label">Recent Schedule Runs</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!runs.length ? (
              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>No schedule executions yet.</div>
            ) : (
              runs.map((run) => (
                <div key={run.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--primary)' }}>{run.mode.toUpperCase()} · {run.triggered_by}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-weak)' }}>{run.started_at.replace('T', ' ').slice(0, 16)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: run.status === 'completed' ? 'var(--secondary)' : 'var(--accent)' }}>{run.status}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{run.processed_count} rows</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Fetched', value: complaints.length, sub: 'latest window' },
          { label: 'Critical', value: riskBreakdown.find((item) => item.name === 'CRITICAL')?.value ?? 0, sub: 'highest urgency', accent: true },
          { label: 'Live Sources', value: sourceBreakdown.length, sub: 'provenance buckets' },
          { label: 'Total Visible', value: total, sub: 'search result count' },
        ].map((card) => (
          <div key={card.label} className="stat-card">
            <div className="stat-card__label">{card.label}</div>
            <div className="stat-card__value" style={{ color: card.accent ? 'var(--accent)' : 'var(--primary)' }}>{card.value}</div>
            <div className="stat-card__sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 0.8fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header"><span className="section-label">Volume by Date</span></div>
          <div style={{ padding: '14px 18px 10px' }}>
            <AreaChart width={440} height={140} data={volumeData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="liveFeedVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="count" stroke="var(--accent)" fill="url(#liveFeedVolume)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span className="section-label">Risk Breakdown</span></div>
          <div style={{ padding: '14px 18px 10px' }}>
            <BarChart width={260} height={140} data={riskBreakdown} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" fill="var(--accent)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span className="section-label">Source Provenance</span></div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sourceBreakdown.map((source) => (
              <div key={source.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--secondary)' }}>{source.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--primary)' }}>{source.value}</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${Math.min(100, (source.value / Math.max(1, complaints.length)) * 100)}%`, background: source.name.includes('live') ? 'var(--success)' : 'var(--accent)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="section-label">Latest Complaints</span>
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Click any row to inspect</span>
        </div>
        <div style={{ overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Issue</th>
                <th>Institution</th>
                <th>State</th>
                <th>Risk</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {complaints.slice(0, 14).map((row) => (
                <tr key={row.id} onClick={() => setSelected(row)} style={{ cursor: 'pointer' }}>
                  <td style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{row.date}</td>
                  <td style={{ color: 'var(--primary)' }}>{row.product}</td>
                  <td style={{ color: 'var(--secondary)' }}>{row.issue}</td>
                  <td>{row.company}</td>
                  <td style={{ color: 'var(--text-weak)' }}>{row.state}</td>
                  <td style={{ color: row.risk === 'CRITICAL' ? 'var(--accent)' : row.risk === 'HIGH' ? 'var(--secondary)' : 'var(--text-weak)' }}>{row.risk}</td>
                  <td style={{ color: 'var(--text-faint)' }}>{row.source.replaceAll('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
