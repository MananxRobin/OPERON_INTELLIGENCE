import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ComplaintSource =
  | 'live_cfpb'
  | 'synthetic_seed'
  | 'deepseek_generated'
  | 'manual_analysis'
  | 'normalized_batch'
  | 'schedule_batch'
  | string;

export interface DashboardStats {
  total_complaints: number;
  complaints_today: number;
  avg_resolution_time_hrs: number;
  compliance_flags_caught: number;
  auto_resolution_rate: number;
  critical_risk_count: number;
  high_risk_count: number;
  timely_response_rate: number;
  product_distribution: Record<string, number>;
  severity_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
  team_distribution: Record<string, number>;
  needs_human_review_count: number;
  high_regulatory_risk_count: number;
  sla_breach_risk_count: number;
  source_breakdown: Record<string, number>;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface NameValue {
  name: string;
  value: number;
}

export interface RiskHeatmapCell {
  product: string;
  risk_level: string;
  count: number;
}

export interface ResolutionTimeByProduct {
  product: string;
  hours: number;
}

export interface DashboardTrends {
  complaints_over_time: TrendPoint[];
  product_breakdown: NameValue[];
  severity_breakdown: NameValue[];
  risk_breakdown: NameValue[];
  team_breakdown: NameValue[];
  risk_heatmap?: RiskHeatmapCell[];
  resolution_time_by_product?: ResolutionTimeByProduct[];
  criticality_breakdown?: NameValue[];
  baseline_divergence_breakdown?: NameValue[];
}

export interface ComplianceFlag {
  regulation: string;
  regulation_name: string;
  description: string;
  evidence_quote: string;
  severity: string;
}

export interface AuditEntry {
  agent_name: string;
  timestamp: string;
  decision: string;
  confidence: number | null;
  reasoning: string;
  evidence_spans: string[];
  input_summary: string;
  output_summary: string;
  duration_ms?: number;
}

export interface EvidenceReference {
  quote: string;
  start: number;
  end: number;
  label: string;
  source: string;
}

export interface EvidenceMap {
  severity: EvidenceReference[];
  compliance: EvidenceReference[];
  routing: EvidenceReference[];
  review: EvidenceReference[];
  narrative_length?: number;
}

export interface BaselineDelta {
  changed_fields: string[];
  risk_score_delta: number;
  routing_changed: boolean;
  severity_changed: boolean;
  sla_changed: boolean;
  divergence_score: number;
}

export interface BaselineFactor {
  code: string;
  points: number;
  reason: string;
}

export interface BaselineResult {
  severity: string;
  risk_level: string;
  risk_score: number;
  assigned_team: string;
  assigned_tier: string;
  priority: string;
  sla_hours: number;
  review_outcome: string;
  factors: BaselineFactor[];
  reasoning: string;
  comparison?: BaselineDelta;
}

export interface CriticalityComponent {
  code: string;
  label: string;
  score: number;
  reason: string;
}

export interface CriticalityResult {
  score: number;
  level: string;
  components: CriticalityComponent[];
  sla_breach_risk: boolean;
  reasoning: string;
}

export interface ReviewGate {
  needs_human_review: boolean;
  review_reason_codes: string[];
  queues: string[];
  sla_breach_risk: boolean;
  status: string;
  because: string;
}

export interface NormalizationResult {
  confidence: number;
  missing_fields: string[];
  recommendations: string[];
  used_llm: boolean;
}

export interface SourceMetadata {
  source: ComplaintSource;
  source_label?: string | null;
  schedule_id?: number | null;
  schedule_run_id?: number | null;
  normalization_batch_id?: number | null;
  normalization_row_index?: number | null;
  channel?: string | null;
  tags?: string[];
  company?: string | null;
  issue?: string | null;
}

export interface ReviewDecision {
  id?: number;
  complaint_id?: string;
  action: string;
  reviewer?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface ComplaintSummary {
  complaint_id: string;
  status: string;
  product: string | null;
  issue: string | null;
  severity: string | null;
  risk_level: string | null;
  risk_score: number | null;
  assigned_team: string | null;
  priority: string | null;
  submitted_at: string;
  completed_at: string | null;
  narrative_preview: string;
  channel: string;
  customer_state: string | null;
  tags: string[];
  vulnerable_tags: string[];
  processing_time_ms: number | null;
  criticality_score: number | null;
  criticality_level: string | null;
  needs_human_review: boolean;
  review_reason_codes: string[];
  sla_breach_risk: boolean;
  source: ComplaintSource;
  source_label?: string | null;
  baseline_delta?: BaselineDelta | null;
  latest_review_decision?: ReviewDecision | null;
}

export interface SampleComplaint {
  id: string;
  narrative: string;
  narrative_preview: string;
  product: string;
  channel: string;
  customer_state: string;
  tags: string[];
  date_received: string;
}

export interface FullAnalysis {
  complaint_id: string;
  status: string;
  submitted_at: string;
  completed_at: string | null;
  complaint: {
    narrative: string;
    product?: string;
    channel?: string;
    customer_state?: string;
    customer_id?: string;
    date_received?: string;
    tags?: string[];
  };
  classification: {
    product: string;
    sub_product: string;
    issue: string;
    sub_issue: string;
    severity: string;
    sentiment_score: number;
    urgency: string;
    confidence: number;
    key_entities: string[];
    reasoning: string;
    baseline_delta?: BaselineDelta;
  } | null;
  compliance_risk: {
    risk_score: number;
    risk_level: string;
    flags: ComplianceFlag[];
    applicable_regulations: string[];
    requires_escalation: boolean;
    reasoning: string;
  } | null;
  routing: {
    assigned_team: string;
    assigned_tier: string;
    priority: string;
    sla_hours: number;
    escalation_path: string[];
    requires_immediate_attention: boolean;
    reasoning: string;
    because?: string;
  } | null;
  resolution: {
    action_plan: string[];
    customer_response: string;
    internal_notes: string;
    preventive_recommendations: string[];
    estimated_resolution_days: number;
    remediation_amount: string | null;
    reasoning: string;
  } | null;
  qa_validation: {
    overall_score: number;
    checks: { check_name: string; passed: boolean; details: string }[];
    passed: boolean;
    improvements: string[];
    reasoning: string;
  } | null;
  baseline?: BaselineResult | null;
  criticality?: CriticalityResult | null;
  review_gate?: ReviewGate | null;
  evidence_map?: EvidenceMap | null;
  normalization?: NormalizationResult | null;
  source_metadata?: SourceMetadata | null;
  latest_review_decision?: ReviewDecision | null;
  audit_trail: AuditEntry[];
  total_processing_time_ms: number | null;
}

export interface SyntheticCfpbRow {
  id: string;
  date: string;
  product: string;
  company: string;
  state: string;
  issue: string;
  risk: RiskLevel;
  disputed: boolean;
  untimely: boolean;
  source: ComplaintSource;
  channel?: string;
  tags?: string[];
  company_response?: string;
  timely?: string;
  narrative?: string;
}

export interface CfpbSearchResult {
  rows: SyntheticCfpbRow[];
  total: number;
  synthetic: boolean;
  source: ComplaintSource;
  proxyMeta?: Record<string, unknown>;
}

export interface NormalizationPreviewResponse {
  mode: string;
  rows: Array<{
    row_index: number;
    normalized: {
      narrative: string;
      product: string;
      channel: string;
      customer_state: string;
      date_received: string;
      tags: string[];
      issue: string;
      company: string;
    };
    confidence: number;
    missing_fields: string[];
    recommendations: string[];
    used_llm: boolean;
    raw_row: Record<string, unknown>;
  }>;
  total_rows: number;
  high_confidence_rows: number;
  needs_review_rows: number;
}

export interface ScheduleRun {
  id: number;
  schedule_id: number;
  mode: string;
  triggered_by: string;
  status: string;
  result_summary: Record<string, unknown>;
  processed_count: number;
  started_at: string;
  completed_at: string | null;
}

export interface ScheduleDefinition {
  id: number;
  name: string;
  mode: string;
  cadence: string;
  source_type: string;
  payload: Record<string, unknown>;
  status: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_count: number;
  created_at: string;
  updated_at: string;
  runs?: ScheduleRun[];
}

export interface ComplaintFilterOptions {
  products: string[];
  risk_levels: string[];
  states: string[];
  channels: string[];
  tags: string[];
  sources?: string[];
}

export interface ComplaintListResponse {
  complaints: ComplaintSummary[];
  total: number;
  available_filters?: ComplaintFilterOptions;
}

export interface SupervisorDashboardSnapshot {
  counts: {
    needs_human_review: number;
    high_regulatory_risk: number;
    sla_breach_risk: number;
    vulnerable_customer_cases: number;
  };
  queues: {
    needs_human_review: ComplaintSummary[];
    high_regulatory_risk: ComplaintSummary[];
    sla_breach_risk: ComplaintSummary[];
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface Store {
  backendConnected: boolean;
  backendStats: DashboardStats | null;
  backendTrends: DashboardTrends | null;
  processedComplaints: ComplaintSummary[];
  totalProcessed: number;
  sampleComplaints: SampleComplaint[];
  lastSync: Date;

  syntheticCfpbPool: SyntheticCfpbRow[];
  cfpbConnected: boolean;

  searchQuery: string;
  theme: ThemeMode;

  set: (partial: Partial<Omit<Store, 'set'>>) => void;
}

export const useStore = create<Store>((setState) => ({
  backendConnected: false,
  backendStats: null,
  backendTrends: null,
  processedComplaints: [],
  totalProcessed: 0,
  sampleComplaints: [],
  lastSync: new Date(),

  syntheticCfpbPool: [],
  cfpbConnected: false,

  searchQuery: '',
  theme: 'dark',

  set: (partial) => setState((state) => ({ ...state, ...partial })),
}));

// Convenience: access store outside React (no subscription)
export const store = () => useStore.getState();
