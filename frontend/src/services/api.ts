import type {
  ComplaintListResponse,
  ComplaintSummary,
  DashboardStats,
  DashboardTrends,
  FullAnalysis,
  NormalizationPreviewResponse,
  ReviewDecision,
  SampleComplaint,
  ScheduleDefinition,
  ScheduleRun,
  SupervisorDashboardSnapshot,
} from '../store';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function toQuery(params: Record<string, string | number | boolean | null | undefined | Array<string | number>>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => qs.append(key, String(item)));
      return;
    }
    qs.set(key, String(value));
  });
  return qs.toString();
}

export const api = {
  health: () => req<{ status: string }>('/api/health'),
  stats: () => req<DashboardStats>('/api/dashboard/stats'),
  trends: (days = 14) => req<DashboardTrends>(`/api/dashboard/trends?days=${days}`),
  dashboardSupervisor: (limit = 6) => req<SupervisorDashboardSnapshot>(`/api/dashboard/supervisor?limit=${limit}`),
  complaints: (
    limitOrParams:
      | number
      | ({
          limit?: number;
          offset?: number;
          product?: string;
          risk_level?: string;
          customer_state?: string;
          channel?: string;
          tag?: string;
          vulnerable_only?: boolean;
          needs_review?: boolean;
          high_risk?: boolean;
          sla_risk?: boolean;
          source?: string;
        }) = 50,
    offset = 0,
  ) => {
    const params = typeof limitOrParams === 'number'
      ? { limit: limitOrParams, offset }
      : { limit: 50, offset: 0, ...limitOrParams };
    return req<ComplaintListResponse>(`/api/complaints?${toQuery(params)}`);
  },
  complaint: (id: string) => req<FullAnalysis>(`/api/complaints/${id}`),
  complaintBaseline: (id: string) => req<{ complaint_id: string; baseline: FullAnalysis['baseline']; criticality: FullAnalysis['criticality']; review_gate: FullAnalysis['review_gate'] }>(`/api/complaints/${id}/baseline`),
  samples: () => req<{ samples: SampleComplaint[]; total: number }>('/api/complaints/samples'),
  audit: (id: string) => req<{ complaint_id: string; audit_trail: FullAnalysis['audit_trail'] }>(`/api/audit/${id}`),
  submit: (body: object) => req<{ complaint_id: string; status: string; message: string }>('/api/complaints/analyze', { method: 'POST', body: JSON.stringify(body) }),
  submitSync: (body: object) => req<FullAnalysis>('/api/complaints/analyze/sync', { method: 'POST', body: JSON.stringify(body) }),
  batch: (body: object) => req<{ submitted: string[]; count: number; message: string }>('/api/complaints/batch', { method: 'POST', body: JSON.stringify(body) }),

  normalizePreview: (body: object) => req<NormalizationPreviewResponse>('/api/normalize/preview', { method: 'POST', body: JSON.stringify(body) }),
  normalizeSubmit: (body: object) => req<{ batch_id: number; summary: Record<string, unknown>; rows: NormalizationPreviewResponse['rows']; submitted_ids: string[] }>('/api/normalize/submit', { method: 'POST', body: JSON.stringify(body) }),
  normalizationBatch: (id: number) => req<{ batch: Record<string, unknown>; rows: Record<string, unknown>[] }>(`/api/normalization/${id}`),

  schedules: () => req<{ schedules: ScheduleDefinition[]; total: number }>('/api/schedules'),
  createSchedule: (body: object) => req<{ schedule: ScheduleDefinition }>('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),
  runSchedule: (id: number) => req<{ status: string; schedule_id: number }>(`/api/schedules/${id}/run`, { method: 'POST' }),
  pauseSchedule: (id: number, paused = true) => req<{ schedule: ScheduleDefinition }>(`/api/schedules/${id}/pause`, { method: 'POST', body: JSON.stringify({ paused }) }),
  deleteSchedule: (id: number) => req<{ deleted: boolean; schedule_id: number }>(`/api/schedules/${id}`, { method: 'DELETE' }),
  scheduleRuns: (id: number) => req<{ schedule_id: number; runs: ScheduleRun[] }>(`/api/schedules/${id}/runs`),

  supervisorQueue: (params: { queue?: string; limit?: number; offset?: number } = {}) =>
    req<{ queue: string; complaints: ComplaintSummary[]; total: number }>(
      `/api/supervisor/queue?${toQuery({ queue: params.queue ?? 'All', limit: params.limit ?? 100, offset: params.offset ?? 0 })}`
    ),
  submitReview: (complaintId: string, body: ReviewDecision) =>
    req<{ complaint_id: string; review_decision: ReviewDecision | null }>(
      `/api/supervisor/review/${complaintId}`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  cfpbSearch: (params: Record<string, string | number | boolean | Array<string | number> | null | undefined> = {}) =>
    req<any>(`/api/cfpb/search?${toQuery(params)}`),
  cfpbDetail: (complaintId: string) => req<any>(`/api/cfpb/complaints/${complaintId}`),
  cfpbTrends: (params: Record<string, string | number | boolean | Array<string | number> | null | undefined> = {}) =>
    req<any>(`/api/cfpb/trends?${toQuery(params)}`),
  cfpbGeoStates: (params: Record<string, string | number | boolean | Array<string | number> | null | undefined> = {}) =>
    req<any>(`/api/cfpb/geo/states?${toQuery(params)}`),
  cfpbSuggest: (params: Record<string, string | number | boolean | Array<string | number> | null | undefined> = {}) =>
    req<any>(`/api/cfpb/suggest?${toQuery(params)}`),

  stream(id: string, cb: (event: string, data: any) => void): EventSource {
    const es = new EventSource(`/api/complaints/analyze/${id}/stream`);
    es.addEventListener('agent_update', (e) => cb('agent_update', JSON.parse((e as MessageEvent).data)));
    es.addEventListener('analysis_complete', (e) => {
      cb('analysis_complete', JSON.parse((e as MessageEvent).data));
      es.close();
    });
    es.addEventListener('timeout', (e) => {
      cb('timeout', JSON.parse((e as MessageEvent).data));
      es.close();
    });
    es.onerror = () => {
      cb('error', null);
      es.close();
    };
    return es;
  },
};

export async function fetchCfpbComplaints(params: Record<string, string | number | boolean | Array<string | number> | null | undefined> = {}): Promise<any> {
  return api.cfpbSearch(params);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
