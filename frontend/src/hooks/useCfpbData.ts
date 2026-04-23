/**
 * useCfpbData fetches the CFPB proxy and can optionally fall back to the
 * synthetic pool when a page prefers demo continuity over strict live-only data.
 */
import { useState, useEffect, useCallback } from 'react';
import { useStore, store } from '../store';
import type { SyntheticCfpbRow } from '../store';
import { fetchCfpbComplaints } from '../services/api';

interface Params {
  size?:               number;
  date_received_min?:  string;
  date_received_max?:  string;
  refreshTick?:        number;  // increment to force a re-fetch
  product?:            string;
  company?:            string;
  state?:              string;
  submitted_via?:      string;
  tags?:               string[];
  allowSyntheticFallback?: boolean;
}

function parseHit(h: any): SyntheticCfpbRow {
  const s    = h._source ?? {};
  const resp = s.company_response ?? '';
  const disp = s.consumer_disputed ?? '';
  const untimely = resp.startsWith('Untimely') || s.timely !== 'Yes';
  let risk: SyntheticCfpbRow['risk'];
  if (resp.startsWith('Untimely') || disp === 'Yes') risk = 'CRITICAL';
  else if (untimely)                                  risk = 'HIGH';
  else if (resp === 'In progress')                    risk = 'MEDIUM';
  else                                                risk = 'LOW';
  return {
    id:       s.complaint_id ?? h._id ?? String(Math.random()),
    date:     s.date_received?.slice(0, 10) ?? '',
    product:  (s.product?.replace(/[^a-zA-Z ]/g, '').trim() ?? 'Unknown').slice(0, 26),
    company:  (s.company ?? 'Unknown').slice(0, 34),
    state:    s.state ?? '',
    issue:    s.issue ?? '',
    risk,
    disputed: disp === 'Yes',
    untimely,
    source:   'live_cfpb',
    channel:  s.submitted_via ?? '',
    tags:     Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? [s.tags] : []),
    company_response: resp,
    timely:   s.timely ?? '',
    narrative: s.complaint_what_happened ?? '',
  };
}

function extractHits(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.hits?.hits)) return payload.hits.hits;
  return [];
}

function extractTotal(payload: any, fallback: number): number {
  if (Array.isArray(payload)) return payload.length;
  const total = payload?.hits?.total;
  if (typeof total === 'number') return total;
  if (typeof total?.value === 'number') return total.value;
  return fallback;
}

export function useCfpbData(params: Params = {}) {
  const pool = useStore(s => s.syntheticCfpbPool);

  const [rows,      setRows]      = useState<SyntheticCfpbRow[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [synthetic, setSynthetic] = useState(false); // true = using fallback
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let used = false;
    let requestFailed = false;

    try {
      const apiParams: Record<string, string | number | string[]> = {
        size: params.size ?? 250,
        sort: 'created_date_desc',
      };
      if (params.date_received_min) apiParams.date_received_min = params.date_received_min;
      if (params.date_received_max) apiParams.date_received_max = params.date_received_max;
      if (params.product)           apiParams.product = params.product;
      if (params.company)           apiParams.company = params.company;
      if (params.state)             apiParams.state = params.state;
      if (params.submitted_via)     apiParams.submitted_via = params.submitted_via;
      if (params.tags?.length)      apiParams.tags = params.tags;
      const res  = await fetchCfpbComplaints(apiParams);
      const hits = extractHits(res).slice(0, params.size ?? 250);
      if (hits.length > 0) {
        setRows(hits.map(parseHit));
        setTotal(extractTotal(res, hits.length));
        setSynthetic(false);
        store().set({ cfpbConnected: true });
        used = true;
      }
    } catch {
      requestFailed = true;
    }

    if (!used && params.allowSyntheticFallback !== false) {
      const min = params.date_received_min;
      const max = params.date_received_max;
      let filtered = pool;
      if (min) filtered = filtered.filter(r => r.date >= min);
      if (max) filtered = filtered.filter(r => r.date <= max);
      if (params.product) filtered = filtered.filter(r => r.product === params.product);
      if (params.company) filtered = filtered.filter(r => r.company === params.company);
      if (params.state) filtered = filtered.filter(r => r.state === params.state);
      if (params.submitted_via) filtered = filtered.filter(r => (r.channel ?? '').toLowerCase() === params.submitted_via?.toLowerCase());
      if (params.tags?.length) filtered = filtered.filter(r => params.tags?.some(tag => r.tags?.includes(tag)));
      const sliced = filtered.slice(0, params.size ?? 250);
      setRows(sliced);
      setTotal(sliced.length);
      setSynthetic(true);
      store().set({ cfpbConnected: false });
    }

    if (!used && params.allowSyntheticFallback === false) {
      setRows([]);
      setTotal(0);
      setSynthetic(false);
      setError(requestFailed ? 'Live CFPB data is unavailable right now.' : 'No live CFPB complaints were returned for this window.');
      store().set({ cfpbConnected: false });
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, params.allowSyntheticFallback, params.company, params.date_received_min, params.date_received_max, params.product, params.refreshTick, params.size, params.state, params.submitted_via, params.tags]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return { rows, total, loading, synthetic, error, refresh: load };
}
