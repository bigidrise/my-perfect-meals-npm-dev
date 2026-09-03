import type { HumanFoodContext, HumanFoodCreator } from "../../../../shared/humanFoodContext";
import type { SafetyAssessment } from "../../safetyProfileService";
import { buildHumanFoodPromptBlock } from "../buildHumanFoodPromptBlock";
import { validateHumanFoodResult } from "../validateHumanFoodResult";
import type { HumanFoodRequestExecutionState } from "../requestExecutionState";
import { buildRejectedCandidatePrompt } from "../requestExecutionState";

const CREATOR_DIRECTIVES: Record<HumanFoodCreator, string> = {
  recipe_maker: "Build a complete recipe while preserving the chosen meal-builder intent.",
  create_a_dish: "Preserve the requested named dish and adapt it transparently when needed.",
  craving_creator: "Satisfy the craving with meaningful variety across candidates.",
  dessert_creator: "Preserve dessert identity while applying medical and dietary adaptations.",
  beverage_creator: "Preserve beverage identity and pass all beverage-specific medical rules.",
  sushi_creator: "Preserve sushi style and food-safety requirements; do not return a generic bowl.",
};

export function buildCreatorHumanFoodPrompt(
  creator: HumanFoodCreator,
  context: HumanFoodContext,
  executionState?: HumanFoodRequestExecutionState,
): string {
  const rejected = executionState ? buildRejectedCandidatePrompt(executionState) : "";
  return [
    buildHumanFoodPromptBlock(context),
    `- Creator rule: ${CREATOR_DIRECTIVES[creator]}`,
    rejected ? `- ${rejected}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * Build request-local instructions for an incidental allergy conflict.
 * The safety assessment itself remains BLOCKED; only the six Human Food
 * creator routes opt into this adaptation path.
 */
export function buildCreatorAllergenAdaptationPrompt(
  creator: HumanFoodCreator,
  requestText: string,
  assessment: SafetyAssessment,
  context: HumanFoodContext,
): string | null {
  const conflict = assessment.allergyConflict;
  if (
    assessment.result !== "BLOCKED"
    || conflict?.type !== "conflict_adaptable"
  ) {
    return null;
  }

  const normalizedProfile = context.safety.allergies.map((value) => value.toLowerCase());
  const intoleranceOnly = normalizedProfile.some((value) =>
    /\b(intoleran|sensitivity|lactose)\b/.test(value),
  ) && !normalizedProfile.some((value) =>
    /\b(anaphyl|allerg(?:y|ic)|protein allergy)\b/.test(value),
  );

  const strictness = intoleranceOnly
    ? [
        "INTOLERANCE ADAPTATION: remove the triggering substance and use an explicitly free-from substitute where appropriate.",
        "For lactose intolerance, lactose-free dairy may be used only when it is clearly labeled lactose-free; otherwise use a culturally appropriate dairy-free substitute.",
      ]
    : [
        "TRUE ALLERGY ADAPTATION: use zero exposure to the allergen, its proteins, derivatives, stocks, sauces, garnishes, and cross-contact-dependent ingredients.",
        "Do not use merely reduced, low-, or lactose-free dairy for a milk-protein allergy; use a fully milk-protein-free substitute.",
      ];

  return [
    "AUTOMATIC HUMAN FOOD ALLERGEN ADAPTATION — REQUIRED",
    `Creator: ${creator}`,
    `Original request: ${requestText.trim() || conflict.dishName}`,
    `Unsafe allergen categories: ${conflict.allergens.join(", ") || assessment.blockedCategories.join(", ")}`,
    `Detected unsafe terms: ${conflict.matchedTerms.join(", ") || assessment.blockedTerms.join(", ")}`,
    ...strictness,
    "Preserve the requested cuisine, dish/category identity, flavor architecture, and preparation style. Replace the unsafe ingredient's culinary function instead of deleting the identity of the food.",
    "Do not silently redirect to generic Western food and do not rename a different dish as the requested dish.",
    "Every ingredient, sub-ingredient, broth, sauce, seasoning, garnish, and instruction must remain compliant with the full Human Food Context.",
    "If a candidate is rejected, the next candidate must use a materially different safe ingredient strategy while retaining the same cultural and category anchors.",
    "Return only a candidate that passes allergy/intolerance, nutrition, and creator-structure validation.",
  ].join("\n");
}

export function validateCreatorHumanFoodResult(
  creator: HumanFoodCreator,
  result: unknown,
  context: HumanFoodContext,
) {
  return {
    creator,
    ...validateHumanFoodResult(result, context),
  };
}