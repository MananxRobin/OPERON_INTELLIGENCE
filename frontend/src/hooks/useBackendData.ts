import { useEffect, useRef } from 'react';
import { store } from '../store';
import { api } from '../services/api';

export function useBackendData() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function load() {
      try {
        await api.health();
        store().set({ backendConnected: true });

        const [stats, trends, complaints, samples] = await Promise.all([
          api.stats(),
          api.trends(14),
          api.complaints(1000),
          api.samples(),
        ]);

        const hasRealData = (complaints?.total ?? 0) > 0;
        store().set({
          sampleComplaints: samples.samples ?? [],
          lastSync: new Date(),
          ...(hasRealData && {
            backendStats:        stats,
            backendTrends:       trends,
            processedComplaints: complaints.complaints ?? [],
            totalProcessed:      complaints.total ?? 0,
          }),
        });
      } catch {
        store().set({ backendConnected: false });
      }
    }

    load();

    const poll = setInterval(async () => {
      try {
        const [stats, trends, complaints] = await Promise.all([
          api.stats(), api.trends(14), api.complaints(1000),
        ]);
        const hasRealData = (complaints?.total ?? 0) > 0;
        store().set({
          backendConnected: true,
          lastSync: new Date(),
          ...(hasRealData && {
            backendStats:        stats,
            backendTrends:       trends,
            processedComplaints: complaints.complaints ?? [],
            totalProcessed:      complaints.total ?? 0,
          }),
        });
      } catch {
        store().set({ backendConnected: false });
      }
    }, 60_000);

    return () => clearInterval(poll);
  }, []);
}
