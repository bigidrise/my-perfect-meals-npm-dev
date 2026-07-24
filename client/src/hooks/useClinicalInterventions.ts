import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

export type InterventionConditionKey =
  | "nausea"
  | "vomiting"
  | "constipation"
  | "diarrhea"
  | "early_fullness"
  | "poor_appetite"
  | "poor_hydration"
  | "low_protein"
  | "low_calorie"
  | "muscle_preservation_risk"
  | "fatigue"
  | "food_aversion"
  | "rapid_weight_loss"
  | "glucose_concerns"
  | "reflux"
  | "transitioning_off_medication";

export type InterventionSeverity = "none" | "mild" | "moderate" | "severe";

export interface ClinicalIntervention {
  id: string;
  conditionKey: InterventionConditionKey;
  severity: InterventionSeverity;
  notes: string | null;
  escalationFlag: boolean;
  activatedAt: string;
  isActive: boolean;
}

interface UseClinicalInterventionsReturn {
  interventions: Record<InterventionConditionKey, InterventionSeverity>;
  rawInterventions: ClinicalIntervention[];
  loading: boolean;
  saving: Set<InterventionConditionKey>;
  setSeverity: (conditionKey: InterventionConditionKey, severity: InterventionSeverity, notes?: string) => Promise<void>;
  escalationFlags: InterventionConditionKey[];
}

export function useClinicalInterventions(clientUserId: string | null): UseClinicalInterventionsReturn {
  const [rawInterventions, setRawInterventions] = useState<ClinicalIntervention[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Set<InterventionConditionKey>>(new Set());

  const load = useCallback(async () => {
    if (!clientUserId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/pro/clients/${clientUserId}/interventions`);
      setRawInterventions(data?.interventions ?? []);
    } catch {
      setRawInterventions([]);
    } finally {
      setLoading(false);
    }
  }, [clientUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const interventions = rawInterventions.reduce<Record<string, InterventionSeverity>>(
    (acc, i) => {
      if (i.isActive) acc[i.conditionKey] = i.severity;
      return acc;
    },
    {}
  ) as Record<InterventionConditionKey, InterventionSeverity>;

  const escalationFlags = rawInterventions
    .filter(i => i.isActive && i.escalationFlag)
    .map(i => i.conditionKey as InterventionConditionKey);

  const setSeverity = useCallback(
    async (conditionKey: InterventionConditionKey, severity: InterventionSeverity, notes?: string) => {
      if (!clientUserId) return;
      setSaving(prev => new Set(prev).add(conditionKey));
      try {
        await apiRequest(`/api/pro/clients/${clientUserId}/interventions`, {
          method: "PUT",
          body: JSON.stringify({ conditionKey, severity, notes: notes ?? null }),
        });
        await load();
      } finally {
        setSaving(prev => {
          const next = new Set(prev);
          next.delete(conditionKey);
          return next;
        });
      }
    },
    [clientUserId, load]
  );

  return { interventions, rawInterventions, loading, saving, setSeverity, escalationFlags };
}
