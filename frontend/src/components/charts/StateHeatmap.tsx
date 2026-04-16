import { useState } from 'react';

// Standard geographic tile-grid layout for US states
const GRID: (string | null)[][] = [
  [null, null, null, null, null, null, null, null, null, null, 'ME'],
  [null, null, null, null, null, null, null, 'WI', null, 'VT', 'NH'],
  ['WA', 'MT', 'ND', 'MN', 'IL', 'MI', null, 'NY', 'MA', null, null],
  ['OR', 'ID', 'SD', 'IA', 'IN', 'OH', 'PA', 'NJ', 'CT', 'RI', null],
  ['CA', 'NV', 'WY', 'NE', 'MO', 'KY', 'WV', 'VA', 'MD', 'DE', null],
  [null, 'AZ', 'CO', 'KS', 'TN', 'NC', 'SC', 'DC', null, null, null],
  [null, 'NM', 'OK', 'AR', 'MS', 'AL', 'GA', null, null, null, null],
  [null, null, 'TX', 'LA', null, null, 'FL', null, null, null, null],
  ['AK', null, null, null, null, null, null, null, null, 'HI', null],
];

// Multi-stop color scale: near-black → dark red → bright red
function tileColor(count: number, max: number): string {
  if (count === 0 || max === 0) return 'var(--bg-2)';
  const t = Math.pow(count / max, 0.55); // sqrt-ish scale spreads low values
  if (t < 0.15) return `rgba(140,22,18,${0.18 + t * 1.2})`;
  if (t < 0.40) return `rgba(180,32,24,${0.28 + t * 0.8})`;
  if (t < 0.70) return `rgba(210,50,38,${0.50 + t * 0.5})`;
  return `rgba(232,67,58,${0.72 + t * 0.28})`;
}

function textColor(count: number, max: number): string {
  if (count === 0) return 'var(--muted-3)';
  const t = Math.pow(count / max, 0.55);
  return t > 0.35 ? 'var(--primary)' : 'var(--secondary)';
}

interface Props {
  data: Record<string, number>;
  onStateClick?: (state: string) => void;
  selectedState?: string | null;
}

export default function StateHeatmap({ data, onStateClick, selectedState }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...Object.values(data), 1);
  const CELL = 44;
  const GAP  = 2;

  const top5 = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Grid */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {GRID.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: GAP }}>
              {row.map((st, ci) => {
                if (!st) return <div key={ci} style={{ width: CELL, height: CELL, flexShrink: 0 }} />;
                const count   = data[st] ?? 0;
                const isHov   = hovered === st;
                const isSel   = selectedState === st;
                return (
                  <div
                    key={ci}
                    onMouseEnter={() => setHovered(st)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onStateClick?.(st)}
                    style={{
                      width: CELL, height: CELL, flexShrink: 0,
                      background: tileColor(count, max),
                      border: `1px solid ${isSel ? 'var(--accent)' : isHov ? 'var(--text-weak)' : 'var(--border)'}`,
                      borderRadius: 2,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      cursor: onStateClick ? 'pointer' : 'default',
                      transition: 'border-color 0.1s, transform 0.1s',
                      transform: isHov ? 'scale(1.08)' : 'scale(1)',
                      zIndex: isHov ? 2 : 1,
                      position: 'relative',
                    }}
                  >
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: textColor(count, max),
                      letterSpacing: '0.03em', lineHeight: 1,
                    }}>
                      {st}
                    </span>
                    {count > 0 && (
                      <span style={{
                        fontSize: count >= 100 ? 7 : 8,
                        color: textColor(count, max),
                        fontVariantNumeric: 'tabular-nums',
                        marginTop: 2, lineHeight: 1, opacity: 0.9,
                      }}>
                        {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>Low</span>
          <div style={{ display: 'flex', gap: 1 }}>
            {[0, 0.08, 0.18, 0.32, 0.50, 0.68, 0.84, 1.0].map((t, i) => (
              <div key={i} style={{
                width: 22, height: 6, borderRadius: 1,
                background: t === 0 ? 'var(--bg-2)' : `rgba(232,67,58,${t})`,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>High</span>
          {hovered && (
            <span style={{ marginLeft: 10, fontSize: 10, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: 'var(--text-weak)' }}>{hovered} </span>
              {(data[hovered] ?? 0).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Right: top states ranking */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
        <div style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Top States
        </div>
        {top5.map(([st, n], i) => (
          <div
            key={st}
            onClick={() => onStateClick?.(st)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0', cursor: onStateClick ? 'pointer' : 'default',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 9, color: 'var(--text-faint)', minWidth: 12, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--secondary)', minWidth: 28 }}>{st}</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div className="hbar-track" style={{ margin: 0 }}>
                <div className="hbar-fill" style={{
                  width: `${(n / (top5[0]?.[1] || 1)) * 100}%`,
                  background: i === 0 ? 'var(--accent)' : 'var(--text-faint)',
                }} />
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>
              {n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
