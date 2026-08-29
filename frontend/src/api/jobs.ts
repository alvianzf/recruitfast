import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export type WorkMode = "remote" | "onsite" | "hybrid";

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

export type Seniority = "entry" | "mid" | "senior" | "lead" | "executive";

export const SENIORITY_LABEL: Record<Seniority, string> = {
  entry: "Entry-level",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / Principal",
  executive: "Executive",
};

export type JobType = "full_time" | "part_time" | "contract" | "internship" | "temporary";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

export interface Job {
  id: string;
  slug: string;
  title: string;
  overview: string | null;
  description: string | null;
  headcount: number;
  work_mode: WorkMode | null;
  location: string | null;
  seniority: Seniority | null;
  job_type: JobType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_confidential: boolean;
  status: string;
  owner_recruiter_id: string | null;
  team_id: string | null;
  team_name: string | null;
  created_at: string;
  unique_visitor_count: number;
  applicant_count: number;
  client_id: string | null;
  client_name: string | null;
}

export interface CreateJobInput {
  title: string;
  overview?: string;
  description?: string;
  headcount?: number;
  work_mode?: WorkMode | null;
  location?: string;
  seniority?: Seniority | null;
  job_type?: JobType | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_confidential?: boolean;
  // Org-only — assigns the job to a team at creation instead of leaving
  // it fully open. org_admin never becomes the job's owner; there is no
  // "assign to me" option, by design. See docs/01.
  team_id?: string | null;
  client_id?: string | null;
}

export interface UpdateJobInput {
  title?: string;
  overview?: string | null;
  description?: string | null;
  headcount?: number;
  work_mode?: WorkMode | null;
  location?: string | null;
  seniority?: Seniority | null;
  job_type?: JobType | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_confidential?: boolean;
  status?: string;
  client_id?: string | null;
  clear_client?: boolean;
}

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data } = await api.get<Job[]>("/jobs");
      return data;
    },
  });
}

export function useJob(jobId: string) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => (await api.get<Job>(`/jobs/${jobId}`)).data,
    enabled: !!jobId,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateJobInput) => {
      const { data } = await api.post<Job>("/jobs", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useUpdateJob(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateJobInput) => {
      const { data } = await api.patch<Job>(`/jobs/${jobId}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });
}

export function useClaimJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data } = await api.post<Job>(`/jobs/${jobId}/claim`);
      return data;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job", job.id] });
    },
  });
}

export function useAssignJob(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // Exactly one of the two — assigning to a team clears any specific
    // recruiter owner and vice versa. See AssignJobRequest server-side.
    mutationFn: async (target: { recruiterId: string } | { teamId: string }) => {
      const payload = "recruiterId" in target ? { recruiter_id: target.recruiterId } : { team_id: target.teamId };
      const { data } = await api.post<Job>(`/jobs/${jobId}/assign`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });
}
