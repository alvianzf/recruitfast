import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "./client";

export interface SkillFilter {
  name: string;
  min_years?: number | null;
  used_since_year?: number | null;
  condition_match: "all" | "any";
}

export interface MatchedSkill {
  name: string;
  years_of_experience: string | null;
  last_used: string | null;
}

export interface CandidateSearchResult {
  id: string;
  full_name: string;
  current_position: string | null;
  total_years_experience: string | null;
  location: string | null;
  scope: "org" | "public";
  matched_skills: MatchedSkill[];
}

export function useKnownSkills() {
  return useQuery({
    queryKey: ["candidate-skills"],
    queryFn: async () => (await api.get<string[]>("/candidates/skills")).data,
  });
}

export function useSearchCandidates() {
  return useMutation({
    mutationFn: async (input: { skills: SkillFilter[]; skill_match: "all" | "any" }) =>
      (await api.post<CandidateSearchResult[]>("/candidates/search", input)).data,
  });
}
