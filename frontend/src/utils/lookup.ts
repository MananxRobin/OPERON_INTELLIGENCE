import { syntheticAnalysis } from '../services/syntheticAnalysis';
import type {
  ComplaintSummary,
  CustomerLookupResponse,
  LookupRecord,
  TicketHistoryEvent,
  TicketRecord,
} from '../store';

function bySubmittedDesc<T extends { submitted_at?: string | null }>(left: T, right: T) {
  return String(right.submitted_at ?? '').localeCompare(String(left.submitted_at ?? ''));
}

export function buildLookupRecordsFromSummaries(complaints: ComplaintSummary[]): LookupRecord[] {
  return [...complaints]
    .sort(bySubmittedDesc)
    .map((summary) => {
      const detail = syntheticAnalysis(summary);
      const customer = detail.customer_profile!;
      const ticket = detail.ticket!;

      return {
        customer_id: customer.customer_id,
        full_name: customer.full_name,
        state: customer.state,
        credit_score: customer.credit_score,
        default_probability: customer.default_probability,
        previous_complaints_count: customer.previous_complaints_count,
        complaint_id: summary.complaint_id,
        ticket_id: ticket.ticket_id,
        ticket_status: ticket.status,
        product: summary.product ?? detail.classification?.product ?? 'Unknown',
        issue: summary.issue ?? detail.classification?.issue ?? 'General handling',
        risk_level: summary.risk_level ?? detail.compliance_risk?.risk_level ?? 'MEDIUM',
        criticality_score: summary.criticality_score ?? detail.criticality?.score ?? 0,
        assigned_team: summary.assigned_team ?? detail.routing?.assigned_team ?? 'Unassigned',
        queue: detail.internal_teams?.primary_team.queue ?? 'Complaint Operations',
        submitted_at: summary.submitted_at,
      };
    });
}

export function filterLookupRecords(records: LookupRecord[], query: string): LookupRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return records;

  return records.filter((record) =>
    [
      record.customer_id,
      record.full_name,
      record.complaint_id,
      record.ticket_id,
      record.product,
      record.issue,
      record.assigned_team,
      record.state,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  );
}

function mergeTimeline(tickets: TicketRecord[]): TicketHistoryEvent[] {
  return tickets
    .flatMap((ticket) => ticket.history ?? [])
    .sort((left, right) => String(right.timestamp ?? '').localeCompare(String(left.timestamp ?? '')))
    .slice(0, 24);
}

export function buildCustomerLookupFromSummaries(
  complaints: ComplaintSummary[],
  customerId: string,
): CustomerLookupResponse | null {
  const details = complaints
    .map((summary) => syntheticAnalysis(summary))
    .filter((detail) => detail.customer_profile?.customer_id === customerId)
    .sort((left, right) => String(right.submitted_at ?? '').localeCompare(String(left.submitted_at ?? '')));

  if (!details.length) return null;

  const latest = details[0];
  const profile = { ...latest.customer_profile! };
  const tickets = details.map((detail) => detail.ticket!).sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')));
  const history = details.map((detail) => ({
    complaint_id: detail.complaint_id,
    ticket_id: detail.ticket?.ticket_id ?? '',
    product: detail.classification?.product ?? detail.complaint.product ?? 'Unknown',
    issue: detail.classification?.issue ?? 'General handling',
    risk_level: detail.compliance_risk?.risk_level ?? 'MEDIUM',
    criticality_score: detail.criticality?.score ?? 0,
    assigned_team: detail.routing?.assigned_team ?? 'Unassigned',
    status: detail.status,
    submitted_at: detail.submitted_at,
  }));

  profile.previous_complaints_count = Math.max(0, history.length - 1);

  return {
    customer_id: customerId,
    profile,
    metrics: {
      total_complaints: history.length,
      open_tickets: tickets.filter((ticket) => !['closed', 'resolved'].includes(ticket.status)).length,
      critical_cases: history.filter((item) => item.risk_level === 'CRITICAL').length,
      high_risk_cases: history.filter((item) => ['HIGH', 'CRITICAL'].includes(item.risk_level)).length,
      total_products: profile.open_products.length,
      total_loans: profile.open_products.filter((product) => product.toLowerCase().includes('loan') || product.toLowerCase().includes('mortgage')).length,
    },
    complaints: history,
    tickets,
    timeline: mergeTimeline(tickets),
    latest_complaint_id: latest.complaint_id,
  };
}
