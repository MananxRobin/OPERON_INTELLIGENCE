import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AgentSubnav } from '../components/agent/AgentSubnav';
import { api } from '../services/api';
import { useStore } from '../store';
import type { CustomerLookupResponse, LookupRecord } from '../store';
import { buildCustomerLookupFromSummaries, buildLookupRecordsFromSummaries, filterLookupRecords } from '../utils/lookup';

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function riskColor(level: string) {
  if (level === 'CRITICAL') return 'var(--accent)';
  if (level === 'HIGH') return 'var(--secondary)';
  return 'var(--text-weak)';
}

export default function Lookup() {
  const navigate = useNavigate();
  const complaints = useStore((state) => state.processedComplaints);

  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<LookupRecord[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [lookup, setLookup] = useState<CustomerLookupResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fallbackRecords = useMemo(() => buildLookupRecordsFromSummaries(complaints), [complaints]);
  const visibleRecords = useMemo(
    () => (records.length ? records : filterLookupRecords(fallbackRecords, query)),
    [fallbackRecords, query, records]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRecords() {
      setLoadingList(true);
      try {
        const payload = await api.lookupRecords({ q: query, limit: 160 });
        if (cancelled) return;
        setRecords(payload.records ?? []);
        setSelectedCustomerId((current) => current || payload.records?.[0]?.customer_id || '');
      } catch {
        if (!cancelled) {
          const fallback = filterLookupRecords(fallbackRecords, query);
          setRecords([]);
          setSelectedCustomerId((current) => current || fallback[0]?.customer_id || '');
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }

    void loadRecords();
    return () => {
      cancelled = true;
    };
  }, [fallbackRecords, query]);

  useEffect(() => {
    if (!visibleRecords.length) {
      setSelectedCustomerId('');
      setLookup(null);
      return;
    }
    if (!selectedCustomerId || !visibleRecords.some((record) => record.customer_id === selectedCustomerId)) {
      setSelectedCustomerId(visibleRecords[0]?.customer_id ?? '');
    }
  }, [selectedCustomerId, visibleRecords]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      if (!selectedCustomerId) {
        setLookup(null);
        return;
      }
      setLoadingDetail(true);
      try {
        const payload = await api.lookupCustomer(selectedCustomerId);
        if (!cancelled) setLookup(payload);
      } catch {
        if (!cancelled) {
          setLookup(buildCustomerLookupFromSummaries(complaints, selectedCustomerId));
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    void loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [complaints, selectedCustomerId]);

  const activeRecord = visibleRecords.find((record) => record.customer_id === selectedCustomerId) ?? visibleRecords[0];
  const profile = lookup?.profile;
  const latestTicket = lookup?.tickets?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AgentSubnav />

      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Look-up</h1>
        <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
          Customer history, live complaint tickets, account context, and prior complaint flow for internal teams
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 176px)' }}>
        <div className="panel" style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-label">Customer / Ticket Search</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{visibleRecords.length}</span>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, ticket, complaint, team…"
              style={{ width: '100%', padding: '7px 10px', fontSize: 11 }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loadingList && !visibleRecords.length ? (
              <div style={{ padding: '24px 18px', color: 'var(--text-faint)', fontSize: 11 }}>Loading look-up records…</div>
            ) : !visibleRecords.length ? (
              <div style={{ padding: '24px 18px', color: 'var(--text-faint)', fontSize: 11 }}>No matching customer records.</div>
            ) : (
              visibleRecords.map((record) => {
                const active = record.customer_id === selectedCustomerId;
                return (
                  <button
                    key={`${record.customer_id}-${record.ticket_id}`}
                    onClick={() => setSelectedCustomerId(record.customer_id)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      textAlign: 'left',
                      background: active ? 'var(--panel-hover)' : 'transparent',
                      border: 'none',
                      borderTop: '1px solid var(--border)',
                      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500 }}>{record.full_name}</span>
                      <span className="badge badge-gray">{record.ticket_id}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 6 }}>
                      {record.product} · {record.issue}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{record.customer_id}</span>
                      <span style={{ fontSize: 9, color: riskColor(record.risk_level) }}>{record.risk_level}</span>
                      <span style={{ fontSize: 9, color: 'var(--secondary)' }}>{record.assigned_team}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedCustomerId || !activeRecord ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-faint)', fontSize: 11 }}>
              Select a customer record to view the dossier.
            </div>
          ) : loadingDetail && !lookup ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-faint)', fontSize: 11 }}>
              Loading customer profile…
            </div>
          ) : !lookup || !profile ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-faint)', fontSize: 11 }}>
              Customer profile unavailable.
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div className="panel-header" style={{ gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{profile.full_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-weak)', marginTop: 3 }}>
                    {profile.customer_id} · {profile.segment} · {profile.service_tier}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {latestTicket && <span className="badge badge-gray">{latestTicket.ticket_id}</span>}
                  {latestTicket && (
                    <span className={`badge ${latestTicket.status === 'pending_supervisor' ? 'badge-red' : 'badge-gray'}`}>
                      {latestTicket.stage}
                    </span>
                  )}
                  <button
                    className="btn btn-ghost"
                    onClick={() => navigate(`/complaints/${lookup.latest_complaint_id}`)}
                    style={{ fontSize: 10 }}
                  >
                    Open Complaint →
                  </button>
                </div>
              </div>

              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
                  {[
                    ['Total Complaints', lookup.metrics.total_complaints],
                    ['Open Tickets', lookup.metrics.open_tickets],
                    ['Critical Cases', lookup.metrics.critical_cases],
                    ['High Risk', lookup.metrics.high_risk_cases],
                    ['Products', lookup.metrics.total_products],
                    ['Loans', lookup.metrics.total_loans],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="stat-card" style={{ padding: '14px 14px 12px' }}>
                      <div className="stat-card__label">{label}</div>
                      <div className="stat-card__value" style={{ fontSize: 20 }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div className="section-label" style={{ marginBottom: 10 }}>Customer Profile</div>
                    {[
                      ['Credit Score', profile.credit_score],
                      ['Delinquency', `${profile.delinquency_days} days`],
                      ['Default Probability', formatPct(profile.default_probability)],
                      ['Previous Complaints', profile.previous_complaints_count],
                      ['Preferred Channel', profile.preferred_channel],
                      ['KYC Tier', profile.kyc_tier],
                      ['Hardship Program', profile.hardship_program ? 'Yes' : 'No'],
                      ['Fraud Watch', profile.fraud_watch ? 'Yes' : 'No'],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--primary)' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="section-label" style={{ marginBottom: 10 }}>Account Overview</div>
                    {[
                      ['Annual Income', formatMoney(profile.annual_income_usd)],
                      ['Relationship Value', formatMoney(profile.relationship_value_usd)],
                      ['Deposit Balance', formatMoney(profile.deposit_balance_usd)],
                      ['Revolving Balance', formatMoney(profile.revolving_balance_usd)],
                      ['Loan Balance', formatMoney(profile.loan_balance_usd)],
                      ['Utilization', formatPct(profile.credit_utilization_ratio)],
                      ['Next Payment Due', profile.next_payment_due],
                      ['Open Products', profile.open_products.join(', ')],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-weak)' }}>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--primary)', textAlign: 'right' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
                  <div>
                    <div className="section-label" style={{ marginBottom: 10 }}>Complaint History</div>
                    <div className="panel" style={{ overflow: 'hidden' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ticket</th>
                            <th>Product</th>
                            <th>Issue</th>
                            <th>Risk</th>
                            <th>Team</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lookup.complaints.map((complaint) => (
                            <tr key={complaint.complaint_id} onClick={() => navigate(`/complaints/${complaint.complaint_id}`)} style={{ cursor: 'pointer' }}>
                              <td style={{ color: 'var(--primary)' }}>{complaint.ticket_id}</td>
                              <td>{complaint.product}</td>
                              <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{complaint.issue}</td>
                              <td style={{ color: riskColor(complaint.risk_level) }}>{complaint.risk_level}</td>
                              <td>{complaint.assigned_team}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="section-label" style={{ marginBottom: 10 }}>Ticket Timeline</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(lookup.timeline ?? []).map((event, index) => (
                        <div key={`${event.code}-${index}`} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--primary)' }}>{event.label}</span>
                            <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{event.timestamp?.slice(0, 16).replace('T', ' ') ?? '—'}</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--secondary)', lineHeight: 1.6 }}>{event.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
