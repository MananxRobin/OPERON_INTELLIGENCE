import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { lazy, Suspense } from 'react';

const Dashboard          = lazy(() => import('./pages/Dashboard'));
const Analyze            = lazy(() => import('./pages/Analyze'));
const Complaints         = lazy(() => import('./pages/Complaints'));
const LiveFeed           = lazy(() => import('./pages/LiveFeed'));
const AuditTrail         = lazy(() => import('./pages/AuditTrail'));
const EnforcementRadar   = lazy(() => import('./pages/EnforcementRadar'));
const InstitutionMonitor = lazy(() => import('./pages/InstitutionMonitor'));
const Analysis           = lazy(() => import('./pages/Analysis'));
const Explorer           = lazy(() => import('./pages/Explorer'));
const Triage             = lazy(() => import('./pages/Triage'));
const Supervisor         = lazy(() => import('./pages/Supervisor'));
const Docs               = lazy(() => import('./pages/Docs'));

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/"           element={<Suspense fallback={<Spinner />}><Dashboard /></Suspense>} />
          <Route path="/analyze"    element={<Suspense fallback={<Spinner />}><Analyze /></Suspense>} />
          <Route path="/complaints" element={<Suspense fallback={<Spinner />}><Complaints /></Suspense>} />
          <Route path="/complaints/:id" element={<Suspense fallback={<Spinner />}><Complaints /></Suspense>} />
          <Route path="/live"         element={<Suspense fallback={<Spinner />}><LiveFeed /></Suspense>} />
          <Route path="/audit"        element={<Suspense fallback={<Spinner />}><AuditTrail /></Suspense>} />
          <Route path="/enforcement"  element={<Suspense fallback={<Spinner />}><EnforcementRadar /></Suspense>} />
          <Route path="/institutions" element={<Suspense fallback={<Spinner />}><InstitutionMonitor /></Suspense>} />
          <Route path="/analysis"     element={<Suspense fallback={<Spinner />}><Analysis /></Suspense>} />
          <Route path="/explorer"     element={<Suspense fallback={<Spinner />}><Explorer /></Suspense>} />
          <Route path="/triage"       element={<Suspense fallback={<Spinner />}><Triage /></Suspense>} />
          <Route path="/supervisor"   element={<Suspense fallback={<Spinner />}><Supervisor /></Suspense>} />
          <Route path="/docs"         element={<Suspense fallback={<Spinner />}><Docs /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
