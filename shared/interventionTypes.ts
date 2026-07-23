/**
 * Shared intervention type labels — used by both the UI and any
 * future server-side reporting that needs human-readable condition names.
 */
export const INTERVENTION_CONDITION_LABELS: Record<string, string> = {
  nausea:                       "Nausea",
  vomiting:                     "Vomiting",
  constipation:                 "Constipation",
  diarrhea:                     "Diarrhea",
  early_fullness:               "Early Fullness",
  poor_appetite:                "Reduced Appetite",
  poor_hydration:               "Poor Hydration",
  low_protein:                  "Protein Intake Too Low",
  low_calorie:                  "Calories Consistently Too Low",
  muscle_preservation_risk:     "Lean-Tissue Risk",
  fatigue:                      "Fatigue / Low Energy",
  food_aversion:                "Food Aversion",
  rapid_weight_loss:            "Rapid Weight Loss",
  glucose_concerns:             "Blood Glucose Concerns",
  reflux:                       "Reflux / Heartburn",
  transitioning_off_medication: "Transitioning Off Medication",
};

export const INTERVENTION_SEVERITY_LABELS: Record<string, string> = {
  none:     "None",
  mild:     "Mild",
  moderate: "Moderate",
  severe:   "Severe",
};
