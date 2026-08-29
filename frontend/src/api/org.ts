import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface Recruiter {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  team_id: string | null;
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

export interface OrgProfile {
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
  office_location: string | null;
  contact_email: string | null;
  preferred_currency: string;
}

export interface OrgProfileUpdateInput {
  logo_url?: string | null;
  description?: string | null;
  office_location?: string | null;
  contact_email?: string | null;
  preferred_currency?: string;
}

export function useOrgProfile() {
  return useQuery({
    queryKey: ["org-profile"],
    queryFn: async () => (await api.get<OrgProfile>("/org/profile")).data,
  });
}

export function useUpdateOrgProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: OrgProfileUpdateInput) => (await api.patch<OrgProfile>("/org/profile", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-profile"] }),
  });
}
