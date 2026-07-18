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
 * Falls back to a locally-computed prescription if the server is unreachable,
 * so builders degrade gracefully rather than crashing.
 */

import { useState, useEffect, useRef } from "react";
import {
  DailyNutritionPrescription,
  buildFallbackPrescription,
} from "../../../shared/dailyNutritionPrescription";
import { apiRequest } from "@/lib/queryClient";

interface UseDailyPrescriptionInput {
  /** ISO date (YYYY-MM-DD). If empty, hook is idle. */
  dateISO: string;
  /** Grams of starchy carbs consumed so far today */
  starchyConsumed?: number;
  /** Number of starch meals logged so far today */
  starchMealsUsed?: number;
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

    const url = `/api/prescription/${dateISO}${params.toString() ? `?${params}` : ""}`;

    apiRequest("GET", url)
      .then((data: DailyNutritionPrescription) => {
        if (thisCount === fetchCount.current) {
          setPrescription(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (thisCount === fetchCount.current) {
          console.warn("[useDailyPrescription] Server unreachable, using fallback:", err);
          setPrescription(buildFallbackPrescription(dateISO));
          setError("Using offline targets");
          setIsLoading(false);
        }
      });
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, starchyConsumed, starchMealsUsed, disabled]);

  return { prescription, isLoading, error, refetch: fetch };
}
