/**
 * resolveEffectiveDiet — single authoritative resolver for builder diet overrides.
 *
 * The builder's temporary diet selection REPLACES the profile's primary
 * dietary identity for ONE generation only. It does NOT mutate the saved
 * profile and does NOT affect hard restrictions, which are enforced
 * separately through the protocol envelope:
 *
 *   • allergies           → enforced by enforceSafetyProfile + filterMealsByProtocol
 *   • medicalConditions   → enforced by the protocol/guardrail system
 *   • specialtyConditions → enforced by the protocol/guardrail system
 *   • religious rules     → embedded in dietaryIdentity, preserved when no override
 *
 * Semantics: if `dietOverride` is present and non-empty it REPLACES
 * `profileDietaryRestrictions` as the primary diet identity. If absent or
 * empty the profile diet is returned unchanged.
 *
 * This function is intentionally pure — no DB calls, no side effects.
 */
export function resolveEffectiveDiet(
  dietOverride: string | string[] | null | undefined,
  profileDietaryRestrictions: string[],
): string[] {
  if (dietOverride) {
    const arr = Array.isArray(dietOverride) ? dietOverride : [dietOverride];
    const filtered = arr.map((d) => d.trim()).filter(Boolean);
    if (filtered.length > 0) {
      // Replacement — profile primary diet is excluded for this generation.
      // Do NOT merge Vegan + Keto; pick one.
      return filtered;
    }
  }
  return Array.isArray(profileDietaryRestrictions)
    ? profileDietaryRestrictions
    : [];
}
