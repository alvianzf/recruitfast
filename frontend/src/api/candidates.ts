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

export function useCandidates() {
  return useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data } = await api.get<Candidate[]>("/candidates");
      return data;
    },
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
