/**
 * useNutritionSummary.ts
 *
 * Dashboard self summary: cached baseline and independently refreshed context.
 * Professional provided summaries never trigger a self query.
 *
 * Cache is invalidated by:
 *   mpm:targetsUpdated      — macro targets changed
 *   mpm:conditionsUpdated   — health conditions / specialtyConditions changed
 *   mpm:therapeuticUpdated  — therapeutic support card saved
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient as sharedQueryClient } from "@/lib/queryClient";
import type { NutritionPersonalizationSummary } from "@/types/nutritionSummary";
import { composeNutritionSummary, type NutritionSummaryDynamicContext } from "@/lib/nutritionSummaryContext";
import { registerNutritionSummaryCacheClearer } from "./nutritionStateCache";

const key = ["nutrition-summary"];
registerNutritionSummaryCacheClearer(() => {
  // Cancellation also prevents an old in-flight response from repopulating the cache.
  void sharedQueryClient.cancelQueries({ queryKey: key });
  sharedQueryClient.removeQueries({ queryKey: key });
});

async function fetchSummary<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`${res.status}: Failed to fetch nutrition summary`);
  return res.json();
}

export function useNutritionSummary(enabled = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const previousUserId = useRef(userId);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (previous && previous !== userId) {
      const oldSelfQuery = (query: { queryKey: readonly unknown[] }) => query.queryKey[2] === previous;
      void queryClient.cancelQueries({ queryKey: key, predicate: oldSelfQuery });
      queryClient.removeQueries({ queryKey: key, predicate: oldSelfQuery });
    }
  }, [queryClient, userId]);

  const baseline = useQuery<NutritionPersonalizationSummary>({
    queryKey: [...key, "baseline", userId],
    queryFn: ({ signal }) => fetchSummary("/api/nutrition-summary/baseline", signal),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const dynamic = useQuery<NutritionSummaryDynamicContext>({
    queryKey: [...key, "dynamic", userId],
    queryFn: ({ signal }) => fetchSummary("/api/nutrition-summary/dynamic", signal),
    enabled: enabled && !!userId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!enabled || !userId || !dynamic.data?.nextDayBoundaryAt) return;
    const untilBoundary = Date.parse(dynamic.data.nextDayBoundaryAt) - Date.now();
    if (!Number.isFinite(untilBoundary)) return;
    const timer = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: [...key, "dynamic", userId] });
    }, Math.max(0, untilBoundary));
    return () => window.clearTimeout(timer);
  }, [enabled, userId, dynamic.data?.nextDayBoundaryAt, queryClient]);

  useEffect(() => {
    if (!enabled || !userId) return;
    const invalidateBaseline = () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "baseline", userId] });
    };
    const invalidateDynamic = () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "dynamic", userId] });
    };
    const invalidateBoth = () => {
      invalidateBaseline();
      invalidateDynamic();
    };
    const targetsUpdated = (event: Event) => {
      if ((event as CustomEvent).detail?.reason === "performanceDate") {
        invalidateDynamic();
      } else {
        invalidateBoth();
      }
    };
    window.addEventListener("mpm:targetsUpdated", targetsUpdated);
    window.addEventListener("mpm:conditionsUpdated", invalidateBoth);
    window.addEventListener("mpm:therapeuticUpdated", invalidateBoth);
    window.addEventListener("mpm:glucoseUpdated", invalidateDynamic);
    window.addEventListener("mpm:hydrationUpdated", invalidateDynamic);
    window.addEventListener("mpm:performanceUpdated", invalidateDynamic);
    window.addEventListener("mpm:dietaryUpdated", invalidateBoth);
    // Builder selection is displayed in the stable Life Plan and changes its label.
    window.addEventListener("mpm:builderUpdated", invalidateBaseline);
    return () => {
      window.removeEventListener("mpm:targetsUpdated", targetsUpdated);
      window.removeEventListener("mpm:conditionsUpdated", invalidateBoth);
      window.removeEventListener("mpm:therapeuticUpdated", invalidateBoth);
      window.removeEventListener("mpm:glucoseUpdated", invalidateDynamic);
      window.removeEventListener("mpm:hydrationUpdated", invalidateDynamic);
      window.removeEventListener("mpm:performanceUpdated", invalidateDynamic);
      window.removeEventListener("mpm:dietaryUpdated", invalidateBoth);
      window.removeEventListener("mpm:builderUpdated", invalidateBaseline);
    };
  }, [queryClient, userId, enabled]);

  return {
    ...baseline,
    data: baseline.data && composeNutritionSummary(
      baseline.data,
      dynamic.isFetching || dynamic.isError ? undefined : dynamic.data,
    ),
    isDynamicLoading: dynamic.isFetching,
    isDynamicError: dynamic.isError,
  };
}
