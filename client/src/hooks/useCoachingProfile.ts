import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface CoachingProfileData {
  id: string;
  user_id: string;
  coaching_style: string | null;
  accountability_pref: string | null;
  motivations: string[] | null;
  lifestyle_flags: string[] | null;
  biggest_challenges: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CoachingProfilePayload {
  coaching_style?: string;
  accountability_pref?: string;
  motivations?: string[];
  lifestyle_flags?: string[];
  biggest_challenges?: string[];
}

const QUERY_KEY = ["/api/ace/profile"];

export function useCoachingProfile() {
  return useQuery<CoachingProfileData | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/ace/profile");
      return (data as any).profile ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveCoachingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CoachingProfilePayload) => {
      const data = await apiRequest("POST", "/api/ace/profile", payload);
      return (data as any).profile as CoachingProfileData;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(QUERY_KEY, profile);
    },
  });
}
