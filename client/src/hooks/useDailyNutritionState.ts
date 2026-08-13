/**
 * useDailyNutritionState
 *
 * Fetches the canonical DailyNutritionState for a given date from
 * GET /api/nutrition-state/:dateISO.
 *
 * This is the single source of truth every meal builder reads for:
 *   - resolvedPrescription  → macro targets (calories, protein, carbs, fat)
 *   - consumed              → what has been explicitly logged in macro_logs
 *   - remaining             → prescription − consumed (server-floored at 0)
 *   - mealPlan              → starch meal counts, meals-per-day config
 *   - activeConstraints     → which protocols are shaping today's prescription
 *
 * No builder should compute its own remaining-budget from board contents.
 * Board meals are "planned" (Stage 2 work); macro_logs are "consumed".
 *
 * Auth: requireAuth — coaches read a client's state via ?clientId= (the server
 * verifies the coach–client relationship before serving the data).
 */

import { useState, useEffect, useRef } from "react";
import type { DailyNutritionState } from "../../../shared/dailyNutritionPrescription";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  _nutritionStateCache,
  _nutritionStateCacheKey,
  getCachedNutritionState,
  setCachedNutritionState,
  getCacheGeneration,
} from "./nutritionStateCache";

// Re-export so callers that previously imported from this module still work.
export {
  _nutritionStateCache,
  _nutritionStateCacheKey,
  getCachedNutritionState,
  setCachedNutritionState,
} from "./nutritionStateCache";

interface UseDailyNutritionStateInput {
  /** ISO date (YYYY-MM-DD). Hook is idle when empty. */
  dateISO: string;
  /**
   * ProCare: coach-supplied client user ID. The server verifies the active
   * coach–client relationship before returning the client's state.
   */
  clientId?: string | null;
  /** Disable fetching entirely (e.g. when the date is not yet resolved). */
  disabled?: boolean;
}

interface UseDailyNutritionStateResult {
  state: DailyNutritionState | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDailyNutritionState({
  dateISO,
  clientId,
  disabled = false,
}: UseDailyNutritionStateInput): UseDailyNutritionStateResult {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  // Seed state synchronously from the module-level cache on the very first render.
  // Cache is scoped to the authenticated viewer's user ID so two accounts that
  // share a tab session never see each other's health data.
  // getCachedNutritionState applies the date-staleness guard so an entry written
  // on a previous calendar day is treated as a miss (forces a fresh fetch).
  // This means `effectivelyLoading` starts as false on repeat visits (warm cache),
  // so neither DailyTargetsCard nor RemainingMacrosFooter ever flashes the shimmer.
  const [state, setState] = useState<DailyNutritionState | null>(() => {
    if (!userId || !dateISO || disabled) return null;
    return getCachedNutritionState(_nutritionStateCacheKey(userId, dateISO, clientId)) ?? null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);

  const fetch = () => {
    if (!dateISO || disabled) return;

    setIsLoading(true);
    setError(null);
    const thisCount = ++fetchCount.current;
    // Snapshot the generation at request-start.  If logout fires while the
    // request is in-flight the generation will have advanced, and the success
    // handler will silently discard the stale response rather than writing it
    // back into the cache for the next user to read.
    const thisGeneration = getCacheGeneration();

    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);

    const url = `/api/nutrition-state/${dateISO}${params.toString() ? `?${params}` : ""}`;

    apiRequest(url)
      .then((data: DailyNutritionState) => {
        if (thisCount === fetchCount.current) {
          if (userId && thisGeneration === getCacheGeneration()) {
            setCachedNutritionState(_nutritionStateCacheKey(userId, dateISO, clientId), data);
          }
          setState(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (thisCount === fetchCount.current) {
          const msg = err instanceof Error ? err.message : String(err);
          const statusCode = parseInt(msg.split(":")[0], 10);
          if (statusCode === 401 || statusCode === 403) {
            console.error(
              `[useDailyNutritionState] Auth failure (${statusCode}) — nutrition-state endpoint rejected the request.`,
              err,
            );
            setError(`Auth error (${statusCode})`);
          } else {
            console.warn("[useDailyNutritionState] Server unreachable, nutrition state unavailable:", err);
            setError("Nutrition state unavailable");
          }
          setState(null);
          setIsLoading(false);
        }
      });
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, clientId, disabled]);

  // Automatically re-fetch whenever a macro log mutation fires the global
  // "macros:updated" event — covers "Log to macros", "Log All", and any other
  // path that writes to macro_logs. This keeps the server-authoritative remaining
  // budget current without requiring builders to manually call refetch().
  useEffect(() => {
    const handler = () => {
      if (!dateISO || disabled) return;
      fetch();
    };
    window.addEventListener("macros:updated", handler);
    return () => window.removeEventListener("macros:updated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, clientId, disabled]);

  // Cover the one-render gap between when the hook becomes enabled (disabled→false,
  // dateISO set) and when the async fetch effect actually runs and flips isLoading→true.
  // Without this, callers see isLoading=false + state=null for one render, which causes
  // them to briefly fall back to the macro-calculator baseline before the prescription
  // arrives (visible number swap on training days).
  const effectivelyLoading =
    isLoading || (!disabled && !!dateISO && state === null && error === null);

  return { state, isLoading: effectivelyLoading, error, refetch: fetch };
}
