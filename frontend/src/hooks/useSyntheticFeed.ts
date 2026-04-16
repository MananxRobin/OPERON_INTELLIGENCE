import { useEffect, useRef } from 'react';
import { store } from '../store';
import { generateSyntheticComplaints, deriveStats, deriveTrends, generateCfpbPool } from '../data/synthetic';
import { generateBatchViaDeepSeek } from '../services/deepseek';

const POLL_MS       = 60 * 1000; // 1 minute
const INITIAL_COUNT = 360;
const BATCH_SIZE    = 50;

// Track newly-added IDs so the UI can flash them
let _newBatchIds: string[] = [];
export function getNewBatchIds() { return _newBatchIds; }

export function useSyntheticFeed() {
  const initialized = useRef(false);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // ── 1. Seed initial synthetic dataset ──────────────────────────────────
    const seed = generateSyntheticComplaints(INITIAL_COUNT);
    applyToStore(seed);

    // ── 1b. Generate CFPB-format pool for all views (instant, no API needed) ─
    const cfpbPool = generateCfpbPool(600);
    store().set({ syntheticCfpbPool: cfpbPool });

    // ── 2. Poll DeepSeek every 10 minutes ──────────────────────────────────
    timerRef.current = setInterval(async () => {
      console.log('[SyntheticFeed] Generating new batch via DeepSeek…');
      const batch = await generateBatchViaDeepSeek(BATCH_SIZE);

      const toAdd = batch.length > 0 ? batch : generateSyntheticComplaints(BATCH_SIZE);
      prependBatch(toAdd);

      // Also grow the CFPB pool so live charts refresh
      const extra = generateCfpbPool(BATCH_SIZE);
      const current = store().syntheticCfpbPool;
      store().set({ syntheticCfpbPool: [...extra, ...current].slice(0, 1000) });
    }, POLL_MS);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyToStore(complaints: ReturnType<typeof generateSyntheticComplaints>) {
  // Only populate if backend is not already providing real data
  const s = store();
  if (s.backendConnected && s.backendStats !== null) return;

  const stats  = deriveStats(complaints);
  const trends = deriveTrends(complaints);

  s.set({
    processedComplaints: complaints,
    totalProcessed:      complaints.length,
    backendStats:        stats,
    backendTrends:       trends,
    lastSync:            new Date(),
  });
}

function prependBatch(batch: ReturnType<typeof generateSyntheticComplaints>) {
  const s = store();
  const existing = s.processedComplaints;

  // Mark new entries
  const tagged = batch.map(c => ({ ...c, _isNew: true }));
  _newBatchIds  = tagged.map(c => c.complaint_id);

  // Clear the "new" flag after 8 seconds
  setTimeout(() => { _newBatchIds = []; }, 8000);

  const merged = [...tagged, ...existing].slice(0, 800); // cap at 800 entries

  const stats  = deriveStats(merged);
  const trends = deriveTrends(merged);

  s.set({
    processedComplaints: merged,
    totalProcessed:      merged.length,
    backendStats:        stats,
    backendTrends:       trends,
    lastSync:            new Date(),
  });

  console.log(`[SyntheticFeed] Added ${batch.length} complaints. Total: ${merged.length}`);
}
