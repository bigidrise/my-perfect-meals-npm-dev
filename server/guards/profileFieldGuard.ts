const REQUIRED_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "activityLevel",
  "fitnessGoal",
  "dietaryRestrictions",
  "allergies",
  "palateSpiceTolerance",
  "palateSeasoningIntensity",
  "palateFlavorStyle",
  "sweetenerPreferences"
];

export function validateProfilePayload(payload: Record<string, any>): { valid: boolean; missing?: string[] } {
  const isFullProfileEdit = "firstName" in payload && "fitnessGoal" in payload;
  if (!isFullProfileEdit) return { valid: true };

  const missing: string[] = [];

  for (const field of REQUIRED_PROFILE_FIELDS) {
    if (!(field in payload)) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}
