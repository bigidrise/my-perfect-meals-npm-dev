/**
 * ⚠️ DEPRECATED — ACE Daily Check-In v1
 *
 * Status: Retired, unmounted, kept only as archived reference.
 * Replaced by: Coach's Corner (client/src/pages/CoachCorner*.tsx)
 *
 * Do NOT import or use these hooks. See DailyCheckinCard.tsx in this same
 * folder for full deprecation rationale.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface DailyCheckinPayload {
  energy: number | null;
  stress: number | null;
  sleep: number | null;
  mood: number | null;
  cravings: number | null;
  hunger: number | null;
  digestion: number | null;
  soreness: number | null;
  schedule: string | null;
  motivation: number | null;
  emotional_eating_risk: number | null;
  symptoms: string[];
  free_text: string;
}

export interface CheckinIntervention {
  key: string;
  situation: string;
  coaching_objective: string;
  strategies: string[];
  avoid: string[];
  evidence_tags: string[];
  suggested_builders: string[];
  severity: string;
}

export interface TodayCheckinResult {
  checkin: Record<string, unknown> | null;
  interventions: CheckinIntervention[];
}

export function useTodaysCheckin() {
  return useQuery<TodayCheckinResult>({
    queryKey: ["ace", "checkin", "today"],
    queryFn: () => apiRequest("/api/ace/checkin/today"),
    staleTime: 60_000,
  });
}

export function useCheckinHistory(days = 7) {
  return useQuery<{ checkins: Record<string, unknown>[] }>({
    queryKey: ["ace", "checkin", "history", days],
    queryFn: () => apiRequest(`/api/ace/checkin/history?days=${days}`),
    staleTime: 60_000,
  });
}

export function useSubmitCheckin() {
  const queryClient = useQueryClient();
  return useMutation<TodayCheckinResult, Error, DailyCheckinPayload>({
    mutationFn: (payload) =>
      apiRequest("/api/ace/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ace", "checkin"] });
    },
  });
}
