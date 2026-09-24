import type { HealthProtocol } from "./healthProtocolState";

/**
 * Personal nutrition preferences, not diagnoses or clinician directives.
 * The same list is used by onboarding, Edit Profile, and the DEV write gate.
 * Do not derive this list from HEALTH_PROTOCOLS: that registry also contains
 * provider-owned and safety-critical states.
 */
export const NUTRITION_SUPPORT_OPTIONS = [
  { protocol: "anti_inflammatory", label: "Anti-Inflammatory Nutrition Support", description: "An additional food-quality preference, separate from your Builder." },
  { protocol: "glp1", label: "GLP-1 Nutrition Support", description: "Nutrition support only. This does not record medication use or change your Builder." },
  { protocol: "diabetes", label: "Diabetes Nutrition Support", description: "A food preference, not a diagnosis or a replacement for glucose safety." },
  { protocol: "cardiac", label: "Heart Nutrition Support", description: "Heart-oriented nutrition preferences, not a cardiac diagnosis.", currentCondition: "cardiac" },
  { protocol: "renal", label: "Kidney Nutrition Support", description: "General nutrition interest, not a kidney diagnosis or a clinical restriction.", currentCondition: "renal" },
  { protocol: "liver_support", label: "Liver Nutrition Support", description: "General nutrition interest, not a liver-disease diagnosis.", currentCondition: "liver-support" },
  { protocol: "thyroid", label: "Thyroid Nutrition Support", description: "Thyroid-oriented nutrition preferences, not a thyroid diagnosis.", currentCondition: "thyroid-support" },
  { protocol: "hormone_optimization", label: "Hormone Nutrition Support", description: "General nutrition preferences, not hormone test results.", currentCondition: "hormone-optimization" },
  { protocol: "menopause", label: "Menopause Nutrition Support", description: "Nutrition preferences without asserting a clinical finding.", currentCondition: "menopause" },
  { protocol: "perimenopause", label: "Perimenopause Nutrition Support", description: "Nutrition preferences without asserting a clinical finding.", currentCondition: "perimenopause" },
  { protocol: "metabolic_recovery", label: "Metabolic Nutrition Support", description: "General nutrition preferences, not a lab interpretation.", currentCondition: "metabolic-recovery" },
  { protocol: "oncology", label: "Oncology Nutrition Support", description: "General food-support intent only; care-team treatment guidance stays separate.", currentCondition: "oncology-support" },
] as const satisfies readonly {
  protocol: HealthProtocol;
  label: string;
  description: string;
  currentCondition?: string;
}[];

export function isSelfSelectableSupport(protocol: HealthProtocol): boolean {
  return NUTRITION_SUPPORT_OPTIONS.some((option) => option.protocol === protocol);
}