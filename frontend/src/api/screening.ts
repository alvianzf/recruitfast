import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface ScreeningQuestion {
  id: string;
  question_text: string;
  expected_answer: string;
  position: number;
}

export interface Application {
  id: string;
  candidate: { id: string; full_name: string; email: string | null; phone: string | null; current_position: string | null };
  cover_letter: string | null;
  answers: { question_id: string; question_text: string; expected_answer: string; answer: string; matched: boolean }[];
  eligible: boolean;
  placement_id: string | null;
  created_at: string;
}

export function useScreeningQuestions(jobId: string) {
  return useQuery({
    queryKey: ["screening-questions", jobId],
    queryFn: async () => (await api.get<ScreeningQuestion[]>(`/jobs/${jobId}/screening-questions`)).data,
    enabled: !!jobId,
  });
}

export function useAddScreeningQuestion(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question_text: string; expected_answer: string }) =>
      (await api.post<ScreeningQuestion>(`/jobs/${jobId}/screening-questions`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screening-questions", jobId] }),
  });
}

export function useDeleteScreeningQuestion(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => api.delete(`/screening-questions/${questionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screening-questions", jobId] }),
  });
}

export function useApplications(jobId: string, eligible?: boolean) {
  return useQuery({
    queryKey: ["applications", jobId, eligible],
    queryFn: async () =>
      (await api.get<Application[]>(`/jobs/${jobId}/applications`, { params: { eligible } })).data,
    enabled: !!jobId,
  });
}

export function useMarkEligible(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) =>
      (await api.post<Application>(`/jobs/${jobId}/applications/${applicationId}/mark-eligible`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications", jobId] });
      queryClient.invalidateQueries({ queryKey: ["placements", jobId] });
    },
  });
}

export interface OpenProfile {
  id: string;
  full_name: string;
  current_position: string | null;
  total_years_experience: string | null;
}

export function useOpenProfiles() {
  return useQuery({
    queryKey: ["open-profiles"],
    queryFn: async () => (await api.get<OpenProfile[]>("/candidates/open-profiles")).data,
  });
}

export function useAttachFromOpenProfile() {
  return useMutation({
    mutationFn: async ({ jobId, candidateId }: { jobId: string; candidateId: string }) =>
      (await api.post(`/jobs/${jobId}/placements/from-open-profile/${candidateId}`)).data,
  });
}
