import { useStore } from '../../store';

export function Topbar() {
  const connected = useStore((s) => s.backendConnected);
  const cfpbConnected = useStore((s) => s.cfpbConnected);
  const total = useStore((s) => s.totalProcessed);
  const searchQuery = useStore((s) => s.searchQuery);
  const lastSync = useStore((s) => s.lastSync);
  const theme = useStore((s) => s.theme);
  const set = useStore((s) => s.set);

  const ts = lastSync instanceof Date
    ? `${String(lastSync.getHours()).padStart(2, '0')}:${String(lastSync.getMinutes()).padStart(2, '0')}:${String(lastSync.getSeconds()).padStart(2, '0')}`
    : '--:--:--';

  return (
    <header
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--accent)',
              opacity: 0.25,
              animation: 'pulse-ring 2s ease-out infinite',
            }}
          />
          <span
            style={{
              position: 'relative',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'block',
            }}
          />
        </span>
      </div>

      <div style={{ flex: 1, maxWidth: 360 }}>
        <input
          type="text"
          placeholder="Search complaints, products, companies…"
          value={searchQuery}
          onChange={(e) => set({ searchQuery: e.target.value })}
          style={{ width: '100%', padding: '6px 12px', fontSize: 11 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button
          className="btn btn-ghost"
          onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })}
          style={{ padding: '5px 10px', fontSize: 9, letterSpacing: '0.08em' }}
        >
          {theme === 'dark' ? 'LIGHT' : 'DARK'}
        </button>
        {total > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
            {total.toLocaleString()} records
          </span>
        )}
        {total > 0 && (
          <span style={{ fontSize: 9, color: 'var(--muted-3)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
            {ts}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              display: 'block',
              background: cfpbConnected ? 'var(--success)' : 'var(--accent)',
              boxShadow: cfpbConnected ? '0 0 4px color-mix(in srgb, var(--success) 50%, transparent)' : undefined,
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: cfpbConnected ? 'var(--success)' : 'var(--text-weak)',
            }}
          >
            CFPB {cfpbConnected ? 'LIVE' : 'SYNTHETIC'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--text-mid)',
              display: 'block',
              animation: 'pulse-ring 3s ease-out infinite',
            }}
          />
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-faint)' }}>AI FEED</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: connected ? 'var(--secondary)' : 'var(--muted-3)',
              display: 'block',
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: connected ? 'var(--secondary)' : 'var(--muted-3)',
            }}
          >
            {connected ? 'BACKEND' : 'DEMO'}
          </span>
        </div>
      </div>
    </header>
  );
}
