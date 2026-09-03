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
 *
 * PHI Isolation
 * ─────────────
 * The hook stores fetched data alongside the identity key (userId:dateISO:clientId)
 * it belongs to. At every render, the returned `state` is synchronously derived:
 *   - When the stored key matches the current render's key → return the stored data.
 *   - When they differ (account switch, client switch, date change) → immediately
 *     return getCachedNutritionState for the NEW key (or null) so no render ever
 *     commits the prior viewer's PHI to the DOM.
 * The paired atomic update (data + key in one setState call) ensures no render
 * window where key and data are out of sync.
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

  // The identity key for this render — includes viewer, date, and delegated client.
  // When any of these changes, currentKey changes and the derived-state guard below
  // synchronously returns the new identity's cached value (or null) on that same render.
  const currentKey =
    userId && dateISO ? _nutritionStateCacheKey(userId, dateISO, clientId) : "";

  // ── Identity-keyed state ────────────────────────────────────────────────────
  // We store { data, key } as a paired unit so data and its identity key are always
  // updated atomically in one React setState call. This prevents any render window
  // where key and data are out of sync after a fetch completes.
  const [fetched, setFetched] = useState<{
    data: DailyNutritionState | null;
    key: string;
  }>(() => {
    if (!userId || !dateISO || disabled) return { data: null, key: "" };
    const key = _nutritionStateCacheKey(userId, dateISO, clientId);
    return { data: getCachedNutritionState(key) ?? null, key };
  });

  // ── Synchronous PHI isolation guard ────────────────────────────────────────
  // Derived at every render — never stored in state with a one-render lag.
  // When currentKey ≠ fetched.key (account switch, client switch, date change),
  // we immediately return the cache for the NEW identity (or null).
  // No render ever commits prior-user/prior-client PHI to the DOM.
  const state: DailyNutritionState | null =
    fetched.key === currentKey
      ? fetched.data
      : (currentKey ? (getCachedNutritionState(currentKey) ?? null) : null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);

  const fetch = () => {
    if (!dateISO || disabled) return;

    // Capture the identity key at call time so the fetch callback always writes
    // to the correct (userId:dateISO:clientId) slot even if props change mid-flight.
    const fetchKey = currentKey;

    setIsLoading(true);
    setError(null);
    const thisCount = ++fetchCount.current;
    // Snapshot the cache generation at request-start. If logout fires while the
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
          // Only write to cache when the generation hasn't advanced (i.e. no logout
          // fired mid-flight). This prevents a logged-out user's response from being
          // written into the cache under the next session's key.
          if (fetchKey && thisGeneration === getCacheGeneration()) {
            setCachedNutritionState(fetchKey, data);
          }
          // Atomic update — data and key written in one setState call so no
          // render can observe a key/data mismatch.
          setFetched({ data, key: fetchKey });
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
          // Null data but key is still updated so the identity guard resolves correctly.
          setFetched({ data: null, key: fetchKey });
          setIsLoading(false);
        }
      });
  };

  // Re-fetch when viewer identity (userId), delegated client (clientId), date, or
  // disabled flag changes. userId is included so an account switch triggers a fresh
  // fetch rather than inheriting prior state through the stale fetchCount guard.
  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dateISO, clientId, disabled]);

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
  }, [userId, dateISO, clientId, disabled]);

  // Cover the one-render gap between when the hook becomes enabled (disabled→false,
  // dateISO set) and when the async fetch effect actually runs and flips isLoading→true.
  // Without this, callers see isLoading=false + state=null for one render, which causes
  // them to briefly fall back to the macro-calculator baseline before the prescription
  // arrives (visible number swap on training days).
  const effectivelyLoading =
    isLoading || (!disabled && !!dateISO && state === null && error === null);

  return { state, isLoading: effectivelyLoading, error, refetch: fetch };
}
