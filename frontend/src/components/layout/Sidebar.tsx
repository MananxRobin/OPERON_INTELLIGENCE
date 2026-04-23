import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../../store';

interface NavItem { to: string; label: string; exact?: boolean; }
interface NavGroup { label: string; items: NavItem[]; }

const GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/',             label: 'Synopsis',            exact: true  },
      { to: '/analysis',     label: 'Analysis' },
      { to: '/teams',        label: 'Teams' },
      { to: '/explorer',     label: 'Explorer' },
    ],
  },
  {
    label: 'Agent',
    items: [
      { to: '/analyze',    label: 'Analyze' },
      { to: '/triage',     label: 'Triage' },
      { to: '/supervisor', label: 'Supervisor' },
      { to: '/lookup',     label: 'Look-up' },
      { to: '/complaints', label: 'Complaints' },
      { to: '/audit',      label: 'Audit Trail' },
    ],
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{ transition: 'transform 0.18s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <path d="M3.5 2L6.5 5L3.5 8" stroke="var(--muted-3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  const location      = useLocation();
  const connected     = useStore(s => s.backendConnected);
  const cfpbConnected = useStore(s => s.cfpbConnected);
  const total         = useStore(s => s.totalProcessed);
  const lastSync      = useStore(s => s.lastSync);

  // Each group open/closed — default both open
  const [open, setOpen] = useState<Record<string, boolean>>({ Overview: true, Agent: true });

  const ts = lastSync instanceof Date
    ? `${String(lastSync.getHours()).padStart(2,'0')}:${String(lastSync.getMinutes()).padStart(2,'0')}:${String(lastSync.getSeconds()).padStart(2,'0')}`
    : '--:--:--';

  const toggleGroup = (label: string) =>
    setOpen(prev => ({ ...prev, [label]: !prev[label] }));

  const isActive = (item: NavItem) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <aside style={{
      width: 200, display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', borderRight: '1px solid var(--border)', flexShrink: 0,
    }}>
      {/* Wordmark */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', padding: '0 18px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <img
          src="/operon-logo.png"
          alt="Operon"
          style={{
            width: 26,
            height: 26,
            objectFit: 'contain',
            marginRight: 10,
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18))',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
          OPERON
        </span>
        <span style={{ marginLeft: 6, fontSize: 8, fontFamily: 'monospace', fontWeight: 600, color: 'var(--sub)', letterSpacing: '0.10em' }}>
          INTELLIGENCE
        </span>
      </div>

      {/* Collapsible navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {GROUPS.map(group => (
          <div key={group.label}>
            {/* Group header — click to expand/collapse */}
            <button
              onClick={() => toggleGroup(group.label)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 18px 7px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 8, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: 'var(--text-faint)',
                userSelect: 'none',
              }}
            >
              <span>{group.label}</span>
              <ChevronIcon open={!!open[group.label]} />
            </button>

            {/* Items — slide in/out */}
            <div style={{
              overflow: 'hidden',
              maxHeight: open[group.label] ? `${group.items.length * 36}px` : '0px',
              transition: 'max-height 0.2s ease',
            }}>
              {group.items.map(item => {
                const active = isActive(item);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    style={{
                      display: 'block', padding: '7px 18px 7px 26px',
                      textDecoration: 'none',
                      borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                      background: active ? 'var(--panel-hover)' : 'transparent',
                      color: active ? 'var(--primary)' : 'var(--text-mid)',
                      fontSize: 11, fontWeight: active ? 500 : 400,
                      transition: 'background 0.1s, color 0.1s',
                      lineHeight: '1.6',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = 'var(--secondary)';
                        (e.currentTarget as HTMLElement).style.background = 'var(--panel-hover)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-mid)';
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }
                    }}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Documentation link */}
      <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <NavLink
          to="/docs"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 18px', textDecoration: 'none',
            borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
            background: isActive ? 'var(--panel-hover)' : 'transparent',
            color: isActive ? 'var(--primary)' : 'var(--text-mid)',
            fontSize: 10, fontWeight: 400,
            transition: 'background 0.1s, color 0.1s',
          })}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--secondary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-mid)'; }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 1h6l2 2v8H2V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
            <path d="M4 5h4M4 7h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          Documentation
        </NavLink>
      </div>

      {/* System status footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '11px 18px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <StatusRow
          label="CFPB"
          value={!connected ? 'OFFLINE' : cfpbConnected ? 'LIVE' : 'CACHE'}
          green={connected && cfpbConnected}
          amber={connected && !cfpbConnected}
        />
        <StatusRow label="Backend" value={connected ? 'ONLINE' : 'OFFLINE'}     amber={!connected} />
        <StatusRow label="Records" value={total.toLocaleString()} />
        <StatusRow label="Sync"    value={ts} mono />
      </div>
    </aside>
  );
}

function StatusRow({ label, value, green, amber, mono }: {
  label: string; value: string; green?: boolean; amber?: boolean; mono?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 9, color: 'var(--muted-3)' }}>{label}</span>
      <span style={{
        fontSize: 9, fontWeight: 600,
        fontFamily: mono ? 'monospace' : undefined,
        color: green ? 'var(--success)' : amber ? 'var(--accent)' : 'var(--text-mid)',
      }}>
        {value}
      </span>
    </div>
  );
}
