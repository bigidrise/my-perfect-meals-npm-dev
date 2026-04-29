/**
 * getEffectiveDietPreference
 *
 * Single source of truth for diet resolution in creator features.
 *
 * Contract:
 *   - overrideEnabled = false  → return onboardingDiet (strict, user's plan)
 *   - overrideEnabled = true   → return overrideDiet if non-empty, else onboardingDiet
 *   - null / undefined handled safely throughout
 *   - No side effects. No UI dependencies. Fully testable.
 *
 * Used by: Fridge Rescue, Create a Dish, Dessert Creator, Beverage Creator, Holidays/Gatherings
 * NOT used by: Weekly Builder, Anti-Inflammatory, Diabetic, GLP-1, Performance, Beach Body
 */
export function getEffectiveDietPreference(
  onboardingDiet: string | string[] | null | undefined,
  overrideDiet: string | null | undefined,
  overrideEnabled: boolean
): string {
  const safeOnboarding = Array.isArray(onboardingDiet)
    ? onboardingDiet.join(", ").trim()
    : (onboardingDiet ?? "").trim();

  const safeOverride = (overrideDiet ?? "").trim();

  if (!overrideEnabled) return safeOnboarding;
  if (safeOverride) return safeOverride;
  return safeOnboarding;
}

export const CREATOR_DIET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "kosher", label: "Kosher" },
  { value: "halal", label: "Halal" },
  { value: "carnivore", label: "Carnivore" },
];

export const CREATOR_CUISINE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "american", label: "American" },
  { value: "mexican", label: "Mexican" },
  { value: "italian", label: "Italian" },
  { value: "indian", label: "Indian" },
  { value: "chinese", label: "Chinese" },
  { value: "japanese", label: "Japanese" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "thai", label: "Thai" },
  { value: "korean", label: "Korean" },
  { value: "middle eastern", label: "Middle Eastern" },
  { value: "greek", label: "Greek" },
  { value: "french", label: "French" },
  { value: "caribbean", label: "Caribbean" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "ethiopian", label: "Ethiopian" },
];
