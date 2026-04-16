import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { useStore } from './store';
import './styles/globals.css';

function ThemeBootstrap() {
  const theme = useStore((state) => state.theme);
  const set = useStore((state) => state.set);

  useEffect(() => {
    const saved = window.localStorage.getItem('sentinel-theme');
    if (saved === 'light' || saved === 'dark') {
      set({ theme: saved });
    }
  }, [set]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('sentinel-theme', theme);
  }, [theme]);

  return <App />;
}

// No StrictMode — avoids double-effect invocation that breaks data hooks
createRoot(document.getElementById('root')!).render(<ThemeBootstrap />);
