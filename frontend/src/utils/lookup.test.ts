import { describe, expect, it } from 'vitest';

import type { ComplaintSummary } from '../store';
import {
  buildCustomerLookupFromSummaries,
  buildLookupRecordsFromSummaries,
  filterLookupRecords,
} from './lookup';

function complaint(overrides: Partial<ComplaintSummary>): ComplaintSummary {
  return {
    complaint_id: 'CMP-0001',
    status: 'analyzed',
    product: 'Credit card',
    issue: 'Billing dispute',
    severity: 'HIGH',
    risk_level: 'HIGH',
    risk_score: 71,
    assigned_team: 'Card Operations Team',
    priority: 'P2_HIGH',
    submitted_at: '2026-04-21T10:00:00',
    completed_at: '2026-04-21T10:05:00',
    narrative_preview: 'Customer disputes a duplicate credit card charge.',
    channel: 'web',
    customer_state: 'CA',
    tags: [],
    vulnerable_tags: [],
    processing_time_ms: 1200,
    criticality_score: 67,
    criticality_level: 'HIGH',
    needs_human_review: true,
    review_reason_codes: ['LOW_CONFIDENCE'],
    sla_breach_risk: false,
    source: 'manual_analysis',
    customer_id: 'CUST-ABC123',
    ticket_id: 'OPR-AAAA-BBBBBB',
    ...overrides,
  };
}

describe('lookup utils', () => {
  it('builds searchable lookup records from complaint summaries', () => {
    const records = buildLookupRecordsFromSummaries([
      complaint({ complaint_id: 'CMP-1000' }),
      complaint({ complaint_id: 'CMP-1001', customer_id: 'CUST-ZZZ999', ticket_id: 'OPR-ZZZZ-999999' }),
    ]);

    expect(records).toHaveLength(2);
    expect(records).toContainEqual(expect.objectContaining({
      complaint_id: 'CMP-1001',
      customer_id: 'CUST-ZZZ999',
      ticket_id: 'OPR-ZZZZ-999999',
    }));
  });

  it('filters lookup records across customer, ticket, and issue fields', () => {
    const records = buildLookupRecordsFromSummaries([
      complaint({ complaint_id: 'CMP-2000', ticket_id: 'OPR-LOOK-000001' }),
      complaint({ complaint_id: 'CMP-2001', issue: 'Mortgage servicing error', product: 'Mortgage', customer_id: 'CUST-MORT01' }),
    ]);

    expect(filterLookupRecords(records, 'look-000001')).toHaveLength(1);
    expect(filterLookupRecords(records, 'mortgage')).toHaveLength(1);
    expect(filterLookupRecords(records, 'cust-')).toHaveLength(2);
  });

  it('builds grouped customer history from repeated customer ids', () => {
    const lookup = buildCustomerLookupFromSummaries(
      [
        complaint({ complaint_id: 'CMP-3000', customer_id: 'CUST-GROUP1', ticket_id: 'OPR-GRP1-000001', submitted_at: '2026-04-20T10:00:00' }),
        complaint({ complaint_id: 'CMP-3001', customer_id: 'CUST-GROUP1', ticket_id: 'OPR-GRP1-000002', submitted_at: '2026-04-21T10:00:00', risk_level: 'CRITICAL', criticality_score: 84 }),
      ],
      'CUST-GROUP1',
    );

    expect(lookup).not.toBeNull();
    expect(lookup?.metrics.total_complaints).toBe(2);
    expect(lookup?.metrics.critical_cases).toBe(1);
    expect(lookup?.complaints[0].complaint_id).toBe('CMP-3001');
    expect(lookup?.tickets[0].ticket_id).toBe('OPR-GRP1-000002');
  });
});
