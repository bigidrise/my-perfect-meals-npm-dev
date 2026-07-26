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

function mapCheckin(raw: Record<string, unknown> | null): TodayCheckinData | null {
  if (!raw) return null;
  return {
    id: (raw.id as string) ?? "",
    submittedAt: (raw.submitted_at ?? raw.submittedAt ?? "") as string,
    checkInDate: (raw.check_in_date ?? raw.checkInDate ?? "") as string,
    nausea: (raw.nausea ?? "none") as string,
    constipation: (raw.constipation ?? "none") as string,
    diarrhea: (raw.diarrhea ?? "none") as string,
    reflux: (raw.reflux ?? "none") as string,
    bloating: (raw.bloating ?? "none") as string,
    earlyFullness: (raw.early_fullness ?? raw.earlyFullness ?? "none") as string,
    foodAversions: (raw.food_aversions ?? raw.foodAversions ?? "none") as string,
    fatigue: (raw.fatigue ?? "none") as string,
    dizziness: (raw.dizziness ?? "none") as string,
    headache: (raw.headache ?? "none") as string,
    vomiting: (raw.vomiting ?? "none") as string,
    canKeepFluidsDown: (raw.can_keep_fluids_down ?? raw.canKeepFluidsDown ?? "yes") as string,
    canEatWithoutWorsening: (raw.can_eat_without_worsening ?? raw.canEatWithoutWorsening ?? "yes") as string,
    reducedUrination: (raw.reduced_urination ?? raw.reducedUrination ?? false) as boolean,
    symptomTrend: (raw.symptom_trend ?? raw.symptomTrend ?? "na") as string,
    appetiteLevel: (raw.appetite_level ?? raw.appetiteLevel ?? "normal") as string,
    notifyCareTeam: (raw.notify_care_team ?? raw.notifyCareTeam ?? "none") as string,
  };
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
      const data = await apiRequest("/api/glp1/hub-checkin/today");
      const checkin = mapCheckin(data.checkin ?? null);
      setState(s => ({
        ...s,
        checkin,
        tolerance: data.tolerance ?? null,
        isLoading: false,
        isSubmitting: false,
        lastUpdated: checkin ? new Date(checkin.submittedAt) : null,
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
      await apiRequest("/api/glp1/hub-checkin", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadToday();
      return true;
    } catch (err) {
      setState(s => ({
        ...s,
        isSubmitting: false,
        error: "Failed to save check-in. Please try again.",
      }));
      return false;
    }
  }, [loadToday]);

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
