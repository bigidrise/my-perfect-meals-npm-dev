export interface DiabetesEligibilityProfile {
  diabetesType?: string | null;
  medicalConditions?: string[] | null;
  healthConditions?: string[] | null;
  specialtyConditions?: string[] | null;
}

const ELIGIBLE_DIABETES_TYPES = new Set(["T1D", "T2D", "PRE_D"]);
const DIABETES_CONDITION_PATTERN =
  /\b(diabet(?:es|ic)?|prediabet(?:es|ic)?|blood\s*sugar)\b/i;

export function isDiabetesFoodPreferenceEligible(
  profile: DiabetesEligibilityProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (
    profile.diabetesType &&
    ELIGIBLE_DIABETES_TYPES.has(profile.diabetesType.trim().toUpperCase())
  ) {
    return true;
  }
  return [
    ...(profile.medicalConditions ?? []),
    ...(profile.healthConditions ?? []),
    ...(profile.specialtyConditions ?? []),
  ].some((condition) =>
    DIABETES_CONDITION_PATTERN.test(condition.replace(/[_-]+/g, " ")),
  );
}