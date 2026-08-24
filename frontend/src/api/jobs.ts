import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface Job {
  id: string;
  title: string;
  overview: string | null;
  status: string;
  owner_recruiter_id: string | null;
}

export interface CreateJobInput {
  title: string;
  overview?: string;
  description?: string;
  unassigned?: boolean;
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
    mutationFn: async (recruiterId: string) => {
      const { data } = await api.post<Job>(`/jobs/${jobId}/assign`, { recruiter_id: recruiterId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });
}
