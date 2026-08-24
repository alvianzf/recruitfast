import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

export interface RecruiterMetrics {
  open_jobs: number;
  total_candidates: number;
  stage_funnel: { stage_name: string; count: number }[];
  active_offers: number;
}

export interface OrgMetrics {
  jobs_by_status: { status: string; count: number }[];
  recruiter_workload: { recruiter_name: string; open_jobs: number }[];
  jobs_open_30_60_90: Record<string, number>;
}

export interface RecruiterPerformancePoint {
  recruiter_id: string;
  recruiter_name: string;
  team_name: string | null;
  open_jobs: number;
  active_candidates: number;
  offers: number;
  won_jobs: number;
  lost_jobs: number;
}

export interface PlatformMetrics {
  active_org_tenants: number;
  freelance_org_members: number;
  total_recruiters: number;
  freelance_queue_depth: number;
}

export function useRecruiterMetrics() {
  return useQuery({
    queryKey: ["metrics", "recruiter"],
    queryFn: async () => (await api.get<RecruiterMetrics>("/metrics/recruiter")).data,
  });
}

export function useOrgMetrics(enabled: boolean, teamId?: string | null) {
  return useQuery({
    queryKey: ["metrics", "org", teamId ?? null],
    queryFn: async () =>
      (await api.get<OrgMetrics>("/metrics/org", { params: teamId ? { team_id: teamId } : undefined })).data,
    enabled,
  });
}

export function useRecruiterPerformance(enabled: boolean, teamId?: string | null) {
  return useQuery({
    queryKey: ["metrics", "org", "recruiters", teamId ?? null],
    queryFn: async () =>
      (
        await api.get<RecruiterPerformancePoint[]>("/metrics/org/recruiters", {
          params: teamId ? { team_id: teamId } : undefined,
        })
      ).data,
    enabled,
  });
}

export function usePlatformMetrics(enabled: boolean) {
  return useQuery({
    queryKey: ["metrics", "platform"],
    queryFn: async () => (await api.get<PlatformMetrics>("/metrics/platform")).data,
    enabled,
  });
}
