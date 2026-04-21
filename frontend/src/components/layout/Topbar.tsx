import { useStore } from '../../store';

export function Topbar() {
  const total = useStore((s) => s.totalProcessed);
  const searchQuery = useStore((s) => s.searchQuery);
  const lastSync = useStore((s) => s.lastSync);
  const theme = useStore((s) => s.theme);
  const set = useStore((s) => s.set);
  const isLight = theme === 'light';

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
          type="button"
          className="theme-switch"
          role="switch"
          aria-checked={isLight}
          aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
          onClick={() => set({ theme: isLight ? 'dark' : 'light' })}
        >
          <span className="theme-switch__label">{isLight ? 'Light' : 'Dark'}</span>
          <span className="theme-switch__track" aria-hidden="true">
            <span className="theme-switch__thumb" />
          </span>
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
      </div>
    </header>
  );
}
