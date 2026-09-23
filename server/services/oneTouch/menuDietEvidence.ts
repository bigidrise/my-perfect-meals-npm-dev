import type { HumanFoodCandidate } from "@shared/humanFoodValidation";
import { validateDietaryRestriction, type DietaryMode } from "../guardrails/validators/dietaryRestrictionValidator";

export type MenuDietEvidence =
  | { status: "supported"; dietaryIdentityCompliant: true }
  | { status: "contradicted"; dietaryIdentityCompliant: false }
  | { status: "unsupported"; dietaryIdentityCompliant: undefined };

const CLASSIFIED_IDENTITIES = new Set<DietaryMode>([
  "vegan", "vegetarian", "pescatarian", "carnivore",
]);

/**
 * Positive evidence is limited to the existing compound-aware identity
 * classifier. It proves known ingredient exclusions with non-low confidence,
 * not numeric keto composition or independent nutrient verification.
 */
export function assessMenuDietEvidence(
  candidate: HumanFoodCandidate,
  effectiveDiets: readonly string[],
): MenuDietEvidence {
  const ingredients = candidate.ingredients?.map((item) =>
    typeof item === "string"
      ? { name: item }
      : { name: item.name ?? item.item ?? "", quantity: String(item.quantity ?? ""), unit: item.unit },
  ) ?? [];
  if (!ingredients.length || ingredients.some((item) => !item.name.trim())) {
    return { status: "unsupported", dietaryIdentityCompliant: undefined };
  }
  let unsupported = effectiveDiets.length === 0;
  for (const value of effectiveDiets) {
    const normalized = value.toLowerCase().trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    if (!CLASSIFIED_IDENTITIES.has(normalized as DietaryMode)) {
      unsupported = true;
      continue;
    }
    try {
      const result = validateDietaryRestriction({
        name: candidate.name ?? "",
        description: candidate.description ?? "",
        ingredients,
        instructions: candidate.instructions,
      }, normalized as DietaryMode);
      if (!result.isValid) return { status: "contradicted", dietaryIdentityCompliant: false };
      if (result.confidence === "low") unsupported = true;
    } catch {
      unsupported = true;
    }
  }
  return unsupported
    ? { status: "unsupported", dietaryIdentityCompliant: undefined }
    : { status: "supported", dietaryIdentityCompliant: true };
}