/**
 * useDailyPrescription
 *
 * Fetches the DailyNutritionPrescription for a given date from the server,
 * passing current consumption totals so the adaptive starch gram guidance
 * reflects what has already been eaten.
 *
 * The hook is cache-friendly: it re-fetches when dateISO, starchyConsumed,
 * or starchMealsUsed changes.
 *
 * Returns null on error — builders should show skeleton loading rather than
 * silently rendering stale fallback data.
 */

import { useState, useEffect, useRef } from "react";
import type {
  DailyNutritionPrescription,
} from "../../../shared/dailyNutritionPrescription";
import { apiRequest } from "@/lib/queryClient";

interface UseDailyPrescriptionInput {
  /** ISO date (YYYY-MM-DD). If empty, hook is idle. */
  dateISO: string;
  /** Grams of starchy carbs consumed so far today */
  starchyConsumed?: number;
  /** Number of starch meals logged so far today */
  starchMealsUsed?: number;
  /**
   * ProCare: when a coach is viewing a client's board, pass the client's
   * user ID here so the server resolves the prescription for that client
   * (after verifying the coach–client relationship).
   */
  clientId?: string | null;
  /** Skip fetching (e.g. professional view where override applies) */
  disabled?: boolean;
}

interface UseDailyPrescriptionResult {
  prescription: DailyNutritionPrescription | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDailyPrescription({
  dateISO,
  starchyConsumed = 0,
  starchMealsUsed = 0,
  clientId,
  disabled = false,
}: UseDailyPrescriptionInput): UseDailyPrescriptionResult {
  const [prescription, setPrescription] = useState<DailyNutritionPrescription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCount = useRef(0);

  const fetch = () => {
    if (!dateISO || disabled) return;

    setIsLoading(true);
    setError(null);
    const thisCount = ++fetchCount.current;

    const params = new URLSearchParams();
    if (starchyConsumed > 0) params.set("starchyConsumed", String(starchyConsumed));
    if (starchMealsUsed > 0) params.set("starchMealsUsed", String(starchMealsUsed));
    if (clientId)            params.set("clientId", clientId);

    const url = `/api/prescription/${dateISO}${params.toString() ? `?${params}` : ""}`;

    apiRequest(url)
      .then((data: DailyNutritionPrescription) => {
        if (thisCount === fetchCount.current) {
          setPrescription(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (thisCount === fetchCount.current) {
          // Distinguish auth failures from genuine network/server errors.
          // A 401/403 means the prescription endpoint has an auth bug — surface it
          // loudly so it doesn't silently mask the entire starch distribution system.
          const msg = err instanceof Error ? err.message : String(err);
          const statusCode = parseInt(msg.split(":")[0], 10);
          if (statusCode === 401 || statusCode === 403) {
            console.error(
              `[useDailyPrescription] Auth failure (${statusCode}) — prescription endpoint rejected the request. ` +
              `Check that the route handler reads req.authUser, not req.user.`,
              err,
            );
            setError(`Auth error (${statusCode})`);
          } else {
            console.warn("[useDailyPrescription] Server unreachable, targets unavailable:", err);
            setError("Prescription unavailable");
          }
          // Return null — builders show skeleton loading instead of stale fallback data.
          setPrescription(null);
          setIsLoading(false);
        }
      });
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, starchyConsumed, starchMealsUsed, clientId, disabled]);

  return { prescription, isLoading, error, refetch: fetch };
}
