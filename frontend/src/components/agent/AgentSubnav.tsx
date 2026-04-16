import { NavLink, useLocation } from 'react-router-dom';

const ITEMS = [
  { to: '/analyze', label: 'Analyze' },
  { to: '/triage', label: 'Triage' },
  { to: '/supervisor', label: 'Supervisor' },
  { to: '/complaints', label: 'Complaints' },
  { to: '/audit', label: 'Audit Trail' },
];

export function AgentSubnav() {
  const location = useLocation();

  const isActive = (to: string) => {
    if (to === '/complaints') return location.pathname.startsWith('/complaints');
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <div className="panel" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Agent Workspace</div>
          <div style={{ fontSize: 11, color: 'var(--text-weak)' }}>
            Process, triage, supervise, inspect, and audit from one operator flow
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ITEMS.map((item) => {
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="btn btn-ghost"
                style={{
                  fontSize: 9,
                  padding: '5px 10px',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  color: active ? 'var(--accent)' : 'var(--secondary)',
                  background: active ? 'var(--highlight)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
