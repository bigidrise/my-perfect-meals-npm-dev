/**
 * useNutritionSummary.ts
 *
 * React Query hook that fetches the NutritionPersonalizationSummary for the
 * authenticated user. Stale time is 5 minutes — the envelope rarely changes
 * mid-session.
 *
 * Cache is invalidated by:
 *   mpm:targetsUpdated      — macro targets changed
 *   mpm:conditionsUpdated   — health conditions / specialtyConditions changed
 *   mpm:therapeuticUpdated  — therapeutic support card saved
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
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition-summary", user?.id] });
    };
    window.addEventListener("mpm:targetsUpdated", invalidate);
    window.addEventListener("mpm:conditionsUpdated", invalidate);
    window.addEventListener("mpm:therapeuticUpdated", invalidate);
    window.addEventListener("mpm:glucoseUpdated", invalidate);
    window.addEventListener("mpm:dietaryUpdated", invalidate);
    window.addEventListener("mpm:builderUpdated", invalidate);
    return () => {
      window.removeEventListener("mpm:targetsUpdated", invalidate);
      window.removeEventListener("mpm:conditionsUpdated", invalidate);
      window.removeEventListener("mpm:therapeuticUpdated", invalidate);
      window.removeEventListener("mpm:glucoseUpdated", invalidate);
      window.removeEventListener("mpm:dietaryUpdated", invalidate);
      window.removeEventListener("mpm:builderUpdated", invalidate);
    };
  }, [queryClient, user?.id]);

  return query;
}
