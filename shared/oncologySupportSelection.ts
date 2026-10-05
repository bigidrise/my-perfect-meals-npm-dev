/** Existing oncology symptoms only; no diagnostic or treatment authority. */
export const ONCOLOGY_SYMPTOM_OPTIONS = [
  { value: "low_appetite", label: "Low appetite" },
  { value: "nausea", label: "Nausea" },
  { value: "mouth_sensitivity", label: "Mouth sensitivity" },
  { value: "fatigue_low_prep", label: "Fatigue / low preparation capacity" },
  { value: "gi_sensitivity", label: "Digestive sensitivity" },
] as const;

export type OncologySymptomSelection = typeof ONCOLOGY_SYMPTOM_OPTIONS[number]["value"];
export interface OncologySupportSelection {
  enabled: boolean;
  symptoms: OncologySymptomSelection[];
  emphasis: { highProteinNutrientDensity: boolean };
}

export function readOncologySupportSelection(value: unknown): OncologySupportSelection {
  // New assignments keep the existing clinician workflow's protein-emphasis
  // default; an explicitly saved false value is preserved below.
  if (value == null) return { enabled: false, symptoms: [], emphasis: { highProteinNutrientDensity: true } };
  const context = value as OncologySupportSelection;
  if (typeof context.enabled !== "boolean" || !Array.isArray(context.symptoms) ||
      context.symptoms.some(s => !ONCOLOGY_SYMPTOM_OPTIONS.some(option => option.value === s)) ||
      typeof context.emphasis?.highProteinNutrientDensity !== "boolean") {
    throw new Error("The stored oncology support configuration could not be verified.");
  }
  return {
    enabled: context.enabled,
    symptoms: [...new Set(context.symptoms)],
    emphasis: { highProteinNutrientDensity: context.emphasis.highProteinNutrientDensity },
  };
}
