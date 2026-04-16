import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useBackendData } from '../../hooks/useBackendData';
import { useSyntheticFeed } from '../../hooks/useSyntheticFeed';

export function AppShell() {
  useBackendData();
  useSyntheticFeed();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg)', color: 'var(--primary)' }}>
      <Topbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
