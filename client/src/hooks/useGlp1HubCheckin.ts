import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { HubCheckinPayload, DailyMedicationTolerance } from "../../../shared/glp1-schema";

export interface TodayCheckinData {
  id: string;
  submittedAt: string;
  checkInDate: string;
  nausea: string;
  constipation: string;
  diarrhea: string;
  reflux: string;
  bloating: string;
  earlyFullness: string;
  foodAversions: string;
  fatigue: string;
  dizziness: string;
  headache: string;
  vomiting: string;
  canKeepFluidsDown: string;
  canEatWithoutWorsening: string;
  reducedUrination: boolean;
  symptomTrend: string;
  appetiteLevel: string;
  notifyCareTeam: string;
}

export interface HubCheckinState {
  checkin: TodayCheckinData | null;
  tolerance: (DailyMedicationTolerance & {
    adaptationEntries?: Array<{
      adaptation: string;
      reason: string;
      evidenceRef: string;
      promptDirective: string;
    }>;
    vomitingFrequency?: string;
    symptomTrend?: string;
    dataSource?: "hub" | "ace" | "none";
    canKeepFluidsDown?: string;
  }) | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useGlp1HubCheckin() {
  const [state, setState] = useState<HubCheckinState>({
    checkin: null,
    tolerance: null,
    isLoading: true,
    isSubmitting: false,
    error: null,
    lastUpdated: null,
  });

  const loadToday = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const data = await apiRequest("GET", "/api/glp1/hub-checkin/today");
      setState(s => ({
        ...s,
        checkin: data.checkin ?? null,
        tolerance: data.tolerance ?? null,
        isLoading: false,
        lastUpdated: data.checkin ? new Date(data.checkin.submitted_at ?? data.checkin.submittedAt) : null,
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: "Failed to load today's check-in",
      }));
    }
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const submit = useCallback(async (payload: Partial<HubCheckinPayload>): Promise<boolean> => {
    setState(s => ({ ...s, isSubmitting: true, error: null }));
    try {
      const data = await apiRequest("POST", "/api/glp1/hub-checkin", payload);
      setState(s => ({
        ...s,
        isSubmitting: false,
        tolerance: data.tolerance ?? null,
        lastUpdated: new Date(),
        checkin: data.checkinId
          ? ({
              id: data.checkinId,
              submittedAt: new Date().toISOString(),
              checkInDate: new Date().toISOString().slice(0, 10),
              ...payload,
            } as TodayCheckinData)
          : s.checkin,
      }));
      return true;
    } catch (err) {
      setState(s => ({
        ...s,
        isSubmitting: false,
        error: "Failed to save check-in. Please try again.",
      }));
      return false;
    }
  }, []);

  return {
    checkin: state.checkin,
    tolerance: state.tolerance,
    isLoading: state.isLoading,
    isSubmitting: state.isSubmitting,
    error: state.error,
    lastUpdated: state.lastUpdated,
    submit,
    reload: loadToday,
  };
}
