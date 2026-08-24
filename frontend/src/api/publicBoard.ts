import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "./client";

export interface PublicJobSummary {
  id: string;
  title: string;
  overview: string | null;
  applicant_count: number;
}

export interface PublicBoardResponse {
  org_name: string;
  jobs: PublicJobSummary[];
}

export interface PublicScreeningQuestion {
  id: string;
  question_text: string;
  position: number;
}

export interface PublicJobDetail {
  id: string;
  title: string;
  overview: string | null;
  description: string | null;
  is_technical_role: boolean;
  applicant_count: number;
  screening_questions: PublicScreeningQuestion[];
}

export function useOrgBoard(slug: string) {
  return useQuery({
    queryKey: ["public-board", slug],
    queryFn: async () => (await api.get<PublicBoardResponse>(`/public/boards/${slug}`)).data,
    enabled: !!slug,
    retry: false,
  });
}

export function useFreelanceBoard() {
  return useQuery({
    queryKey: ["public-board", "freelance"],
    queryFn: async () => (await api.get<PublicBoardResponse>("/public/boards/freelance")).data,
  });
}

export function usePublicJob(jobId: string) {
  return useQuery({
    queryKey: ["public-job", jobId],
    queryFn: async () => (await api.get<PublicJobDetail>(`/public/jobs/${jobId}`)).data,
    enabled: !!jobId,
    retry: false,
  });
}

export interface ApplyInput {
  full_name: string;
  email: string;
  phone: string;
  cover_letter?: string;
  years_of_experience: string;
  linkedin_url: string;
  github_url?: string;
  portfolio_url?: string;
  open_to_other_roles: boolean;
  answers: { question_id: string; answer: string }[];
  cv: File;
}

export function useApplyToJob(jobId: string) {
  return useMutation({
    mutationFn: async (input: ApplyInput) => {
      const form = new FormData();
      form.append("full_name", input.full_name);
      form.append("email", input.email);
      form.append("phone", input.phone);
      if (input.cover_letter) form.append("cover_letter", input.cover_letter);
      form.append("years_of_experience", input.years_of_experience);
      form.append("linkedin_url", input.linkedin_url);
      if (input.github_url) form.append("github_url", input.github_url);
      if (input.portfolio_url) form.append("portfolio_url", input.portfolio_url);
      form.append("open_to_other_roles", String(input.open_to_other_roles));
      form.append("answers_json", JSON.stringify(input.answers));
      form.append("cv", input.cv);
      const { data } = await api.post<{ eligible: boolean; message: string }>(
        `/public/jobs/${jobId}/apply`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
  });
}
