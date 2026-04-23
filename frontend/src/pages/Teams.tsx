import { useMemo } from 'react';

import { TeamsViewWrapper, useTeamsView } from '../components/team/TeamsViewWrapper';

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function TeamWorkspace() {
  const {
    backendConnected,
    visibleTeams,
    loadingTeams,
    selectedTeamCode,
    selectedTeam,
    selectTeamCode,
    query,
    setQuery,
    routedComplaints,
    selectedComplaintId,
    setSelectedComplaintId,
    selectedSummary,
    selectedDetail,
    loadingDetail,
    teamKpis,
    recentTimeline,
  } = useTeamsView();

  const focusTags = useMemo(() => {
    const values = [
      selectedTeam?.focus,
      selectedTeam?.queue,
      selectedDetail?.routing?.priority,
      selectedDetail?.routing?.assigned_tier,
    ].filter(Boolean) as string[];

    return Array.from(new Set(values));
  }, [selectedDetail, selectedTeam]);

  if (!visibleTeams.length && !loadingTeams) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Teams Workspace</h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            Monitor internal team queues, investigate routed complaints, and review ticket activity.
          </p>
        </div>

        <div className="panel" style={{ padding: 24, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>No team queue is available yet</div>
            <div style={{ fontSize: 11, color: 'var(--text-weak)', lineHeight: 1.7 }}>
              {backendConnected
                ? 'As soon as complaints are analyzed and routed, they will appear here by owning team.'
                : 'Reconnect the backend or analyze complaints to populate the Teams workspace.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: '-0.02em' }}>Teams Workspace</h1>
          <p style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 3 }}>
            Internal queues, complaint ownership, and ticket context in one place.
          </p>
        </div>
        <div style={{ fontSize: 10, color: loadingTeams ? 'var(--accent)' : backendConnected ? 'var(--secondary)' : 'var(--text-faint)' }}>
          {loadingTeams ? 'Refreshing teams…' : backendConnected ? 'Backend connected' : 'Backend offline'}
        </div>
      </div>

      <div className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {visibleTeams.map((team) => {
            const active = team.code === selectedTeamCode;
            return (
              <button
                key={team.code}
                className="btn btn-ghost"
                onClick={() => selectTeamCode(team.code)}
                style={{
                  padding: '7px 10px',
                  fontSize: 10,
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  color: active ? 'var(--accent)' : 'var(--text-mid)',
                  background: active ? 'var(--highlight)' : 'transparent',
                }}
              >
                {team.name} ({team.complaint_count})
              </button>
            );
          })}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter complaints by ticket, product, state, priority, or text…"
          style={{ width: '100%', padding: '9px 11px', fontSize: 11 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        <KpiCard label="Queue Size" value={formatNumber(teamKpis.complaintCount)} />
        <KpiCard label="High Risk" value={formatNumber(teamKpis.highRisk)} tone="alert" />
        <KpiCard label="Needs Review" value={formatNumber(teamKpis.review)} tone="alert" />
        <KpiCard label="Avg Criticality" value={formatNumber(teamKpis.avgCriticality, 1)} />
        <KpiCard label="Critical Queue" value={formatNumber(teamKpis.criticalQueue)} tone="alert" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <div className="panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <span className="section-label">
              {selectedTeam?.name ?? 'Team Queue'} ({routedComplaints.length})
            </span>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
            {routedComplaints.map((complaint) => {
              const active = complaint.complaint_id === selectedComplaintId;
              return (
                <button
                  key={complaint.complaint_id}
                  onClick={() => setSelectedComplaintId(complaint.complaint_id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: active ? 'var(--panel-hover)' : 'transparent',
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>{complaint.complaint_id}</span>
                    <span style={{ fontSize: 9, color: complaint.risk_level === 'CRITICAL' ? 'var(--accent)' : 'var(--text-faint)' }}>
                      {complaint.risk_level ?? 'UNSCORED'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--secondary)', marginBottom: 6 }}>
                    {complaint.product ?? 'Uncategorized'} · {complaint.issue ?? 'Issue pending'} · {complaint.customer_state ?? 'N/A'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-weak)', lineHeight: 1.6 }}>
                    {complaint.narrative_preview}
                  </div>
                </button>
              );
            })}

            {!routedComplaints.length && (
              <div style={{ padding: 18, fontSize: 11, color: 'var(--text-weak)' }}>
                No complaints match the current team or filter.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 10 }}>Selected Complaint</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                  {selectedSummary?.complaint_id ?? 'No complaint selected'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 4 }}>
                  {selectedSummary?.product ?? 'Product pending'} · {selectedSummary?.priority ?? 'Priority pending'} · {selectedSummary?.assigned_team ?? selectedTeam?.name ?? 'Unassigned'}
                </div>
              </div>
              <div style={{ fontSize: 10, color: loadingDetail ? 'var(--accent)' : 'var(--secondary)' }}>
                {loadingDetail ? 'Loading detail…' : selectedSummary?.ticket_id ?? 'No ticket yet'}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {focusTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9,
                    color: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    padding: '4px 7px',
                    borderRadius: 999,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-weak)', lineHeight: 1.75 }}>
              {selectedDetail?.complaint.narrative ?? selectedSummary?.narrative_preview ?? 'Complaint detail unavailable.'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Classification</div>
              <KeyValue label="Product" value={selectedDetail?.classification?.product ?? selectedSummary?.product ?? '—'} />
              <KeyValue label="Issue" value={selectedDetail?.classification?.issue ?? selectedSummary?.issue ?? '—'} />
              <KeyValue label="Severity" value={selectedDetail?.classification?.severity ?? selectedSummary?.severity ?? '—'} />
              <KeyValue label="Risk Level" value={selectedDetail?.compliance_risk?.risk_level ?? selectedSummary?.risk_level ?? '—'} />
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Routing</div>
              <KeyValue label="Assigned Team" value={selectedDetail?.routing?.assigned_team ?? selectedSummary?.assigned_team ?? '—'} />
              <KeyValue label="Priority" value={selectedDetail?.routing?.priority ?? selectedSummary?.priority ?? '—'} />
              <KeyValue label="SLA" value={selectedDetail?.routing?.sla_hours ? `${selectedDetail.routing.sla_hours} hours` : '—'} />
              <KeyValue label="Review Gate" value={selectedDetail?.review_gate?.status ?? '—'} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Action Plan</div>
              {selectedDetail?.resolution?.action_plan?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedDetail.resolution.action_plan.map((step) => (
                    <div key={step} style={{ fontSize: 11, color: 'var(--text-weak)', lineHeight: 1.6 }}>
                      {step}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-weak)' }}>No remediation steps available yet.</div>
              )}
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Ticket Timeline</div>
              {recentTimeline.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentTimeline.map((event) => (
                    <div key={`${event.code}-${event.timestamp}`} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)' }}>{event.label}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 2 }}>{event.timestamp}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-weak)', marginTop: 4, lineHeight: 1.5 }}>
                        {event.detail}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-weak)' }}>No ticket history available for this complaint yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'alert' }) {
  return (
    <div className="panel" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-faint)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: tone === 'alert' ? 'var(--accent)' : 'var(--primary)' }}>
        {value}
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--text-mid)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function Teams() {
  return (
    <TeamsViewWrapper>
      <TeamWorkspace />
    </TeamsViewWrapper>
  );
}
