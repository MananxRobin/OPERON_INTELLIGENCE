import type { ComplaintSummary, InternalTeamMetric } from '../store';

function slugifyTeamCode(name: string) {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  if (!normalized) return 'TEAM';

  const initials = normalized
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 6);

  return initials || normalized.slice(0, 6);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildFallbackTeamMetrics(complaints: ComplaintSummary[]): InternalTeamMetric[] {
  const grouped = new Map<string, ComplaintSummary[]>();

  complaints.forEach((complaint) => {
    const teamName = complaint.assigned_team?.trim() || 'Unassigned Operations';
    const current = grouped.get(teamName) ?? [];
    current.push(complaint);
    grouped.set(teamName, current);
  });

  return Array.from(grouped.entries())
    .map(([name, teamComplaints]) => ({
      code: slugifyTeamCode(name),
      name,
      focus: teamComplaints[0]?.product || 'Complaint operations',
      queue: 'Team Queue',
      complaint_count: teamComplaints.length,
      high_risk_count: teamComplaints.filter((complaint) => ['HIGH', 'CRITICAL'].includes(complaint.risk_level ?? '')).length,
      needs_review_count: teamComplaints.filter((complaint) => complaint.needs_human_review).length,
      avg_criticality: average(teamComplaints.map((complaint) => complaint.criticality_score ?? 0)),
      avg_credit_score: 0,
      sample_complaints: teamComplaints
        .slice()
        .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))
        .slice(0, 8),
    }))
    .sort((left, right) => right.complaint_count - left.complaint_count);
}
