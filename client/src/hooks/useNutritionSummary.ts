/**
 * useNutritionSummary.ts
 *
 * React Query hook that fetches the NutritionPersonalizationSummary for the
 * authenticated user. Stale time is 5 minutes — the envelope rarely changes
 * mid-session. Cache is invalidated by mpm:targetsUpdated and mpm:conditionsUpdated events.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import type { NutritionPersonalizationSummary } from "@/types/nutritionSummary";

export function useNutritionSummary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<NutritionPersonalizationSummary>({
    queryKey: ["nutrition-summary", user?.id],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/nutrition-summary"), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch nutrition summary");
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition-summary", user?.id] });
    };
    window.addEventListener("mpm:targetsUpdated", invalidate);
    window.addEventListener("mpm:conditionsUpdated", invalidate);
    return () => {
      window.removeEventListener("mpm:targetsUpdated", invalidate);
      window.removeEventListener("mpm:conditionsUpdated", invalidate);
    };
  }, [queryClient, user?.id]);

  return query;
}
