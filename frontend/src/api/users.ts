import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface Me {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  tenant_id: string | null;
  tenant_type: "org" | "freelance_org" | null;
}

export interface MeUpdateInput {
  full_name?: string;
  email?: string;
  avatar_url?: string | null;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/users/me")).data,
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MeUpdateInput) => (await api.patch<Me>("/users/me", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: async (input: { current_password: string; new_password: string }) =>
      api.post("/users/me/password", input),
  });
}
