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
  const starchyCarbs = candidate.nutrition?.starchyCarbs;
  if (!source.ingredientsComplete || !source.nutritionValuesFinite ||
      typeof starchyCarbs !== "number" || !Number.isFinite(starchyCarbs)) return "evidence_unavailable";

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

  if ((context.status !== "resolved" && context.status !== "resolved_with_gaps") ||
      (context.nutrition?.subject?.userId &&
       context.nutrition.subject.userId !== context.subjectUserId)) return "evidence_unavailable";

  const hasStarch = source.ingredientEvidence.some((entry) => entry.category === "starchy_concentrated");
  if (hasStarch !== (starchyCarbs > 0)) return "repair_required";
  // Source compatibility remains dietary evidence. A daily allocation or its
  // exhaustion cannot turn a compatible recipe into a repair requirement.

  // Positive starch can be considered at the day-planning level; it cannot
  // prove that day's ratio from this recipe alone.
  return uncertain.length || hasStarch ? "no_known_conflict" : "confirmed_compatible";
}