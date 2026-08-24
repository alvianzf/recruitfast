import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

export interface BlacklistEntry {
  reason: string;
  created_at: string;
}

export interface BlacklistStatus {
  email: string;
  blacklisted: boolean;
  entries: BlacklistEntry[];
}

export function useBlacklistStatuses(emails: (string | null | undefined)[]) {
  const normalized = Array.from(new Set(emails.filter((e): e is string => !!e))).sort();

  return useQuery({
    queryKey: ["blacklist-status", normalized],
    queryFn: async () => {
      const params = new URLSearchParams();
      normalized.forEach((e) => params.append("email", e));
      const { data } = await api.get<BlacklistStatus[]>(`/blacklist?${params.toString()}`);
      return data;
    },
    enabled: normalized.length > 0,
  });
}
