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

export function useOrgMetrics(enabled: boolean) {
  return useQuery({
    queryKey: ["metrics", "org"],
    queryFn: async () => (await api.get<OrgMetrics>("/metrics/org")).data,
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
