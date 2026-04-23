import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../../services/api';
import { syntheticAnalysis } from '../../services/syntheticAnalysis';
import { useStore } from '../../store';
import type { ComplaintSummary, FullAnalysis, InternalTeamMetric, TicketHistoryEvent } from '../../store';
import { buildFallbackTeamMetrics } from '../../utils/teamWorkspace';

export interface TeamsViewKpis {
  complaintCount: number;
  highRisk: number;
  review: number;
  avgCriticality: number;
  avgCreditScore: number;
  criticalQueue: number;
}

export interface TeamsViewContextValue {
  backendConnected: boolean;
  visibleTeams: InternalTeamMetric[];
  loadingTeams: boolean;
  selectedTeamCode: string;
  selectedTeam: InternalTeamMetric | null;
  selectTeamCode: (teamCode: string) => void;
  query: string;
  setQuery: (query: string) => void;
  routedComplaints: ComplaintSummary[];
  selectedComplaintId: string;
  setSelectedComplaintId: (complaintId: string) => void;
  selectedSummary: ComplaintSummary | null;
  selectedDetail: FullAnalysis | null;
  loadingDetail: boolean;
  teamKpis: TeamsViewKpis;
  recentTimeline: TicketHistoryEvent[];
}

const TeamsViewContext = createContext<TeamsViewContextValue | null>(null);

function mergeTeamComplaints(team: InternalTeamMetric | null, complaints: ComplaintSummary[]) {
  if (!team) return [];

  const merged = new Map<string, ComplaintSummary>();

  complaints
    .filter((complaint) => complaint.assigned_team === team.name)
    .forEach((complaint) => merged.set(complaint.complaint_id, complaint));

  (team.sample_complaints ?? []).forEach((complaint) => {
    if (!merged.has(complaint.complaint_id)) {
      merged.set(complaint.complaint_id, complaint);
    }
  });

  return Array.from(merged.values()).sort((left, right) => right.submitted_at.localeCompare(left.submitted_at));
}

export function TeamsViewWrapper({ children }: { children: ReactNode }) {
  const backendConnected = useStore((state) => state.backendConnected);
  const complaints = useStore((state) => state.processedComplaints);
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [teamMetrics, setTeamMetrics] = useState<InternalTeamMetric[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<FullAnalysis | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fallbackTeamMetrics = useMemo(() => buildFallbackTeamMetrics(complaints), [complaints]);
  const visibleTeams = teamMetrics.length ? teamMetrics : fallbackTeamMetrics;
  const selectedTeamCode = searchParams.get('team') ?? '';

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      setLoadingTeams(true);
      try {
        const payload = await api.internalTeams();
        if (!cancelled) {
          setTeamMetrics(payload.teams ?? []);
        }
      } catch {
        if (!cancelled) {
          setTeamMetrics([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingTeams(false);
        }
      }
    }

    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!visibleTeams.length) return;
    if (visibleTeams.some((team) => team.code === selectedTeamCode)) return;

    const next = new URLSearchParams(searchParams);
    next.set('team', visibleTeams[0].code);
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedTeamCode, setSearchParams, visibleTeams]);

  const selectedTeam = useMemo(
    () => visibleTeams.find((team) => team.code === selectedTeamCode) ?? visibleTeams[0] ?? null,
    [selectedTeamCode, visibleTeams],
  );

  const routedComplaints = useMemo(() => {
    const teamComplaints = mergeTeamComplaints(selectedTeam, complaints);
    if (!query.trim()) return teamComplaints;

    const normalized = query.trim().toLowerCase();
    return teamComplaints.filter((complaint) =>
      [
        complaint.complaint_id,
        complaint.ticket_id,
        complaint.customer_id,
        complaint.product,
        complaint.issue,
        complaint.channel,
        complaint.customer_state,
        complaint.priority,
        complaint.risk_level,
        complaint.narrative_preview,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [complaints, query, selectedTeam]);

  useEffect(() => {
    if (!routedComplaints.length) {
      setSelectedComplaintId('');
      setSelectedDetail(null);
      setLoadingDetail(false);
      return;
    }

    if (!selectedComplaintId || !routedComplaints.some((complaint) => complaint.complaint_id === selectedComplaintId)) {
      setSelectedComplaintId(routedComplaints[0].complaint_id);
    }
  }, [routedComplaints, selectedComplaintId]);

  const selectedSummary = useMemo(
    () => routedComplaints.find((complaint) => complaint.complaint_id === selectedComplaintId) ?? routedComplaints[0] ?? null,
    [routedComplaints, selectedComplaintId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!selectedSummary) {
        setSelectedDetail(null);
        setLoadingDetail(false);
        return;
      }

      setLoadingDetail(true);
      setSelectedDetail(null);

      try {
        const payload = await api.complaint(selectedSummary.complaint_id);
        if (!cancelled) {
          setSelectedDetail(payload);
        }
      } catch {
        if (!cancelled) {
          setSelectedDetail(syntheticAnalysis(selectedSummary));
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedSummary]);

  const teamKpis = useMemo<TeamsViewKpis>(() => {
    if (!selectedTeam) {
      return {
        complaintCount: 0,
        highRisk: 0,
        review: 0,
        avgCriticality: 0,
        avgCreditScore: 0,
        criticalQueue: 0,
      };
    }

    return {
      complaintCount: selectedTeam.complaint_count,
      highRisk: selectedTeam.high_risk_count,
      review: selectedTeam.needs_review_count,
      avgCriticality: selectedTeam.avg_criticality,
      avgCreditScore: selectedTeam.avg_credit_score,
      criticalQueue: routedComplaints.filter((complaint) => complaint.risk_level === 'CRITICAL').length,
    };
  }, [routedComplaints, selectedTeam]);

  const recentTimeline = useMemo(
    () => selectedDetail?.ticket?.history?.slice(-4).reverse() ?? [],
    [selectedDetail],
  );

  function selectTeamCode(teamCode: string) {
    const next = new URLSearchParams(searchParams);
    if (teamCode) next.set('team', teamCode);
    else next.delete('team');
    setSearchParams(next, { replace: true });
  }

  const value: TeamsViewContextValue = {
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
  };

  return <TeamsViewContext.Provider value={value}>{children}</TeamsViewContext.Provider>;
}

export function useTeamsView() {
  const value = useContext(TeamsViewContext);
  if (!value) {
    throw new Error('useTeamsView must be used inside TeamsViewWrapper.');
  }
  return value;
}
