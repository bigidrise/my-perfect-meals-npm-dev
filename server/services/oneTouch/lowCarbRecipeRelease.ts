import type { HumanFoodCandidate } from "@shared/humanFoodValidation";
import type { HumanFoodContext } from "@shared/humanFoodContext";
import { classifyNutritionalRole } from "../groceryNutritionalRole";
import {
  evaluateLowCarbSourceEvidence, type ContextualSourceDecision,
} from "../foodAdaptation/lowCarbPolicy";

export type LowCarbRecipeRelease =
  | "confirmed_compatible"
  | "no_known_conflict"
  | "repair_required"
  | "evidence_unavailable";

/**
 * A generic recipe is not a product label or a day-level 70/30 certificate.
 * Keep canonical source evidence intact; this separate release decision only
 * permits bounded non-safety uncertainty after nutrition and safety gates run.
 */
export function assessLowCarbRecipeRelease(
  candidate: HumanFoodCandidate,
  context: HumanFoodContext,
  decisions: readonly ContextualSourceDecision[] = [],
): LowCarbRecipeRelease {
  const source = evaluateLowCarbSourceEvidence(candidate.ingredients, candidate.nutrition, decisions);
  if (!source.ingredientsComplete || !source.nutritionValuesFinite ||
      candidate.nutrition?.starchyCarbs == null) return "evidence_unavailable";

  // A known sugar is a repair target even when another ingredient also lacks
  // evidence. Never let uncertainty conceal an identified conflict.
  if (source.ingredientEvidence.some((entry) => entry.category === "added_sugar")) {
    return "repair_required";
  }
  const uncertain = source.ingredientEvidence.filter((entry) =>
    entry.requiresExplicitEvidence || entry.category === "unknown");
  if (uncertain.some((entry) =>
    entry.category !== "dairy_carbohydrate" ||
    !/\b(plain|unsweetened|no[\s-]+added[\s-]+sugar)\b/i.test(entry.ingredient) ||
    /\b(mix|blend|sauce|filling|flavored|sweetened|assorted)\b/i.test(entry.ingredient) ||
    classifyNutritionalRole(entry.ingredient) === "starchy_carb"
  )) return "evidence_unavailable";

  const remaining = context.nutrition?.prescription?.source === "fallback"
    ? null : context.nutrition?.projectedRemaining ?? context.nutrition?.remaining;
  if (context.status !== "resolved" ||
      (context.nutrition?.subject?.userId &&
       context.nutrition.subject.userId !== context.subjectUserId) ||
      !remaining || !["calories", "carbs", "fat"].every((key) => {
        const value = remaining[key as "calories" | "carbs" | "fat"];
        return typeof value === "number" && Number.isFinite(value) && value >= 0;
      })) return "evidence_unavailable";

  const macros = candidate.nutrition!;
  if (macros.calories! > remaining.calories ||
      macros.carbs! > remaining.carbs ||
      macros.fat! > remaining.fat) return "repair_required";

  const hasStarch = source.ingredientEvidence.some((entry) => entry.category === "starchy_concentrated");
  if (hasStarch !== (macros.starchyCarbs > 0)) return "repair_required";
  if (hasStarch && context.nutrition?.activeConstraints?.consumedStarchExhausted) {
    return "repair_required";
  }

  // Positive starch can be considered at the day-planning level; it cannot
  // prove that day's ratio from this recipe alone.
  return uncertain.length || hasStarch ? "no_known_conflict" : "confirmed_compatible";
}