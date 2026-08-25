import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface JobStage {
  id: string;
  name: string;
  position: number;
  is_terminal_reject: boolean;
  is_terminal_success: boolean;
}

export interface Placement {
  id: string;
  candidate_id: string;
  job_id: string;
  current_stage_id: string;
  status: "active" | "rejected" | "withdrawn";
  status_reason: string | null;
  candidate: { id: string; full_name: string; current_position: string | null };
}

export function useJobStages(jobId: string) {
  return useQuery({
    queryKey: ["job-stages", jobId],
    queryFn: async () => (await api.get<JobStage[]>(`/jobs/${jobId}/stages`)).data,
    enabled: !!jobId,
  });
}

export function usePlacements(jobId: string) {
  return useQuery({
    queryKey: ["placements", jobId],
    queryFn: async () => (await api.get<Placement[]>(`/jobs/${jobId}/placements`)).data,
    enabled: !!jobId,
  });
}

export function useAttachCandidate(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (candidateId: string) =>
      (await api.post<Placement>(`/jobs/${jobId}/placements`, { candidate_id: candidateId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["placements", jobId] }),
  });
}

export function useMovePlacement(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ placementId, toStageId }: { placementId: string; toStageId: string }) =>
      (await api.patch<Placement>(`/placements/${placementId}/move`, { to_stage_id: toStageId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["placements", jobId] }),
  });
}

export function useUpdatePlacementStatus(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      status,
      reason,
    }: {
      placementId: string;
      status: "rejected" | "withdrawn";
      reason?: string;
    }) => (await api.patch<Placement>(`/placements/${placementId}/status`, { status, reason })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["placements", jobId] }),
  });
}

export function useAddStage(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<JobStage>(`/jobs/${jobId}/stages`, { name })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job-stages", jobId] }),
  });
}

export function useRenameStage(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageId, name }: { stageId: string; name: string }) =>
      (await api.patch<JobStage>(`/stages/${stageId}`, { name })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job-stages", jobId] }),
  });
}

export function useReorderStages(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stageIds: string[]) =>
      (await api.put<JobStage[]>(`/jobs/${jobId}/stages/reorder`, { stage_ids: stageIds })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job-stages", jobId] }),
  });
}

// 409 with { detail: "N candidate(s) are in this stage..." } means the
// stage is occupied — the caller must retry with reassignToStageId set
// (see docs/03's non-empty-stage-deletion rule).
export function useDeleteStage(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageId, reassignToStageId }: { stageId: string; reassignToStageId?: string }) => {
      await api.delete(`/stages/${stageId}`, {
        params: reassignToStageId ? { reassign_to_stage_id: reassignToStageId } : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-stages", jobId] });
      queryClient.invalidateQueries({ queryKey: ["placements", jobId] });
    },
  });
}

export function useBlacklistCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateId, reason }: { candidateId: string; reason: string }) =>
      (await api.post(`/candidates/${candidateId}/blacklist`, { reason })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["blacklist-status"] });
    },
  });
}
