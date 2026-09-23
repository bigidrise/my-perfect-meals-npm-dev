import type {
  HumanFoodCandidate, HumanFoodRequirementKey, HumanFoodRequirementProof,
} from "@shared/humanFoodValidation";
import { validateDietaryRestriction, type DietaryMode } from "../guardrails/validators/dietaryRestrictionValidator";

export interface MenuDietEvidence {
  status: "supported" | "contradicted" | "unsupported";
  requirements: Partial<Record<HumanFoodRequirementKey, HumanFoodRequirementProof>>;
}

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
  const completeIngredients = ingredients.length > 0 && ingredients.every((item) => item.name.trim());
  let unsupported = effectiveDiets.length === 0;
  let contradicted = false;
  const requirements: MenuDietEvidence["requirements"] = {};
  for (const value of effectiveDiets) {
    const normalized = value.toLowerCase().trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    const key = `dietary_identity:${normalized}` as const;
    if (!CLASSIFIED_IDENTITIES.has(normalized as DietaryMode) || !completeIngredients) {
      requirements[key] = { status: "review_required", source: "none" };
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
      const status = !result.isValid ? "fail" : result.confidence === "low" ? "review_required" : "pass";
      requirements[key] = { status, source: "ingredient_classifier", nutritionBasis: "not_applicable" };
      if (status === "fail") contradicted = true;
      if (status === "review_required") unsupported = true;
    } catch {
      requirements[key] = { status: "review_required", source: "none" };
      unsupported = true;
    }
  }
  return { status: contradicted ? "contradicted" : unsupported ? "unsupported" : "supported", requirements };
}