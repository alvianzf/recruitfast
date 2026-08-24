import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface Note {
  id: string;
  body: string;
  visibility: "team" | "private";
  author: { id: string; full_name: string };
  created_at: string;
}

export function useCandidateNotes(candidateId: string) {
  return useQuery({
    queryKey: ["candidate-notes", candidateId],
    queryFn: async () => (await api.get<Note[]>(`/candidates/${candidateId}/notes`)).data,
    enabled: !!candidateId,
  });
}

export function useAddCandidateNote(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: string; visibility: "team" | "private" }) =>
      (await api.post<Note>(`/candidates/${candidateId}/notes`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate-notes", candidateId] }),
  });
}
