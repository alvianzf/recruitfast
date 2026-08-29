import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { PlacementValueMetrics } from "./metrics";

export interface Client {
  id: string;
  name: string;
  email: string;
  contact_person: string | null;
  phone: string | null;
  notes: string | null;
}

export interface ClientInput {
  name: string;
  email: string;
  contact_person?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface ClientMetrics {
  client: Client;
  job_count: number;
  open_job_count: number;
  placement_count: number;
  revenue: PlacementValueMetrics;
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<Client[]>("/clients")).data,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClientInput) => (await api.post<Client>("/clients", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ClientInput>) => (await api.patch<Client>(`/clients/${clientId}`, input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-metrics", clientId] });
    },
  });
}

export function useClientMetrics(clientId: string | null) {
  return useQuery({
    queryKey: ["client-metrics", clientId],
    queryFn: async () => (await api.get<ClientMetrics>(`/clients/${clientId}/metrics`)).data,
    enabled: !!clientId,
  });
}
