import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface Candidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  current_position: string | null;
  total_years_experience: string | null;
  blacklisted: boolean;
}

export interface PossibleDuplicate {
  candidate_id: string;
  full_name: string;
  email: string | null;
}

export interface CVPreviewItem {
  temp_id: string;
  filename: string;
  parsed_fields: Record<string, unknown> | null;
  parse_confidence: Record<string, unknown> | null;
  parse_status: string;
  error: string | null;
  possible_duplicate: PossibleDuplicate | null;
}

export interface CVCommitItem {
  temp_id: string;
  filename: string;
  resolution: "create" | "skip";
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  current_position?: string | null;
  total_years_experience?: string | null;
  parsed_fields?: Record<string, unknown> | null;
  parse_confidence?: Record<string, unknown> | null;
}

export interface CandidateDetail extends Candidate {
  current_document: {
    original_filename: string;
    parsed_fields: {
      summary?: string[];
      technical_skills?: Record<string, { name: string; years_of_experience: string; last_used: string }[]>;
      education?: { institution: string; major: string | null; year: string }[];
      certifications?: { name: string; issuer: string; year_issued: string }[];
      main_projects?: {
        project_title: string;
        company_name: string | null;
        duration: string | null;
        position: string | null;
        team_description: string | null;
        project_description: string | null;
        responsibilities: string[];
        technologies_used: string[];
      }[];
    };
    parse_confidence: Record<string, unknown>;
    parse_status: string;
  } | null;
}

export function useCandidates() {
  return useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data } = await api.get<Candidate[]>("/candidates");
      return data;
    },
  });
}

export function useCandidate(candidateId: string) {
  return useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: async () => (await api.get<CandidateDetail>(`/candidates/${candidateId}`)).data,
    enabled: !!candidateId,
  });
}

export interface CandidateCv {
  url: string;
  filename: string;
}

export function candidateCvDownloadUrl(candidateId: string): string {
  return `/candidates/${candidateId}/cv`;
}

export function useCandidateCv(candidateId: string | null) {
  return useQuery({
    queryKey: ["candidate-cv", candidateId],
    queryFn: async (): Promise<CandidateCv> => {
      const response = await api.get(`/candidates/${candidateId}/cv`, { responseType: "blob" });
      const disposition = response.headers["content-disposition"] as string | undefined;
      const match = disposition?.match(/filename\*?=(?:utf-8'')?"?([^";]+)"?/i);
      const filename = match ? decodeURIComponent(match[1]) : "cv.pdf";
      return { url: URL.createObjectURL(response.data), filename };
    },
    enabled: !!candidateId,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function useCvParsePreview() {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const { data } = await api.post<{ items: CVPreviewItem[] }>("/candidates/cv/parse-preview", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.items;
    },
  });
}

export function useCvCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: CVCommitItem[]) => {
      const { data } = await api.post<{ created: Candidate[]; skipped_count: number }>("/candidates/cv/commit", {
        items,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}
