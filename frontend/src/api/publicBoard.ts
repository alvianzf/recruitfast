import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { JobType, Seniority, WorkMode } from "./jobs";

export interface PublicJobSummary {
  id: string;
  slug: string;
  title: string;
  overview: string | null;
  applicant_count: number;
  work_mode: WorkMode | null;
  location: string | null;
  seniority: Seniority | null;
  job_type: JobType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  created_at: string;
  org_name: string | null;
  org_logo_url: string | null;
  board_path: string | null;
}

export interface PublicBoardResponse {
  org_name: string;
  org_logo_url: string | null;
  org_description: string | null;
  org_office_location: string | null;
  org_contact_email: string | null;
  jobs: PublicJobSummary[];
}

export interface PublicScreeningQuestion {
  id: string;
  question_text: string;
  question_type: "text" | "number" | "boolean";
  required: boolean;
  position: number;
}

export interface PublicJobDetail {
  id: string;
  title: string;
  overview: string | null;
  description: string | null;
  is_technical_role: boolean;
  applicant_count: number;
  work_mode: WorkMode | null;
  location: string | null;
  seniority: Seniority | null;
  job_type: JobType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  screening_questions: PublicScreeningQuestion[];
  posted_by_name: string;
  org_name: string | null;
  org_logo_url: string | null;
  created_at: string;
  board_path: string;
}

export function useOrgBoard(slug: string) {
  return useQuery({
    queryKey: ["public-board", slug],
    queryFn: async () => (await api.get<PublicBoardResponse>(`/public/boards/${slug}`)).data,
    enabled: !!slug,
    retry: false,
  });
}

export function useAllJobsBoard() {
  return useQuery({
    queryKey: ["public-board", "all"],
    queryFn: async () => (await api.get<PublicBoardResponse>("/public/boards/all")).data,
  });
}

export function usePublicJob(jobSlug: string) {
  return useQuery({
    queryKey: ["public-job", jobSlug],
    queryFn: async () => (await api.get<PublicJobDetail>(`/public/jobs/${jobSlug}`)).data,
    enabled: !!jobSlug,
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

export function useApplyToJob(jobSlug: string) {
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
        `/public/jobs/${jobSlug}/apply`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
  });
}
