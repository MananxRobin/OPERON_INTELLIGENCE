export function RiskGauge({ score = 0, label = 'Risk Score' }: { score?: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone = clamped >= 76 ? 'var(--accent)' : clamped >= 51 ? 'var(--secondary)' : 'var(--text-weak)';

  return (
    <div className="panel" style={{ padding: 16, minWidth: 180 }}>
      <div className="section-label" style={{ marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: '50%',
            background: `conic-gradient(${tone} ${clamped * 3.6}deg, var(--bg-3) 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 700, color: tone, lineHeight: 1 }}>{clamped}</span>
            <span style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 4, letterSpacing: '0.08em' }}>
              /100
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 9, color: 'var(--text-faint)' }}>
        <span>Low</span>
        <span>Elevated</span>
        <span>Critical</span>
      </div>
    </div>
  );
}
