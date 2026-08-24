import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface FreelanceApplication {
  id: string;
  full_name: string;
  email: string;
  linkedin_url: string | null;
  years_experience: number | null;
  specialization: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export function useFreelanceApplications() {
  return useQuery({
    queryKey: ["freelance-applications"],
    queryFn: async () => (await api.get<FreelanceApplication[]>("/admin/freelance-applications")).data,
  });
}

export function useApproveFreelanceApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.post(`/admin/freelance-applications/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelance-applications"] }),
  });
}

export function useRejectFreelanceApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/freelance-applications/${id}/reject`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelance-applications"] }),
  });
}
