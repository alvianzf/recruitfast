import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface Team {
  id: string;
  name: string;
  member_count: number;
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await api.get<Team[]>("/teams")).data,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<Team>("/teams", { name })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => (await api.delete(`/teams/${teamId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["recruiters"] });
    },
  });
}

export function useAssignRecruiterTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recruiterId, teamId }: { recruiterId: string; teamId: string | null }) =>
      (await api.patch(`/org/recruiters/${recruiterId}/team`, { team_id: teamId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recruiters"] }),
  });
}
