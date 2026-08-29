import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

export interface StageConversionPoint {
  stage_name: string;
  avg_days: number;
  min_days: number;
  max_days: number;
  count: number;
}

export interface PlacementValueByCurrency {
  currency: string;
  total: number;
}

export interface PlacementValueMetrics {
  by_currency: PlacementValueByCurrency[];
  preferred_currency: string;
  total_in_preferred_currency: number | null;
}

export interface OpportunityMetrics {
  potential_unrealized: PlacementValueMetrics;
  opportunity_lost: PlacementValueMetrics;
}

export interface JobPipelineMetrics {
  job_id: string;
  job_title: string;
  status: string;
  headcount: number;
  candidate_count: number;
  job_age_days: number;
  avg_stage_days: number | null;
  min_stage_days: number | null;
  max_stage_days: number | null;
  conversion_rate: number | null;
}

export interface RecruiterMetrics {
  open_jobs: number;
  total_candidates: number;
  stage_funnel: { stage_name: string; count: number }[];
  active_offers: number;
  placement_value: PlacementValueMetrics;
  opportunity: OpportunityMetrics;
  time_to_hire_avg_days: number | null;
  time_to_hire_min_days: number | null;
  time_to_hire_max_days: number | null;
  stage_conversion: StageConversionPoint[];
  pipeline_breakdown: JobPipelineMetrics[];
}

export interface OrgMetrics {
  jobs_by_status: { status: string; count: number }[];
  recruiter_workload: { recruiter_name: string; open_jobs: number }[];
  jobs_open_30_60_90: Record<string, number>;
  placement_value: PlacementValueMetrics;
  opportunity: OpportunityMetrics;
  time_to_hire_avg_days: number | null;
  time_to_hire_min_days: number | null;
  time_to_hire_max_days: number | null;
  stage_conversion: StageConversionPoint[];
  pipeline_breakdown: JobPipelineMetrics[];
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
