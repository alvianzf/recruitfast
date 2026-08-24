import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface Recruiter {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
}

export function useRecruiters() {
  return useQuery({
    queryKey: ["recruiters"],
    queryFn: async () => (await api.get<Recruiter[]>("/org/recruiters")).data,
  });
}

export function useInviteRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { full_name: string; email: string; password: string }) =>
      (await api.post<Recruiter>("/org/recruiters", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recruiters"] }),
  });
}

export function useDeactivateRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch<Recruiter>(`/org/recruiters/${id}/deactivate`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recruiters"] }),
  });
}

export function useReassignJobs() {
  return useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) =>
      (await api.post<{ reassigned_count: number }>(`/org/recruiters/${fromId}/reassign-jobs`, { to_recruiter_id: toId }))
        .data,
  });
}
