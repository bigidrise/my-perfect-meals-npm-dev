import type { HumanFoodContext, HumanFoodCreator } from "../../../../shared/humanFoodContext";
import { buildHumanFoodPromptBlock } from "../buildHumanFoodPromptBlock";
import { validateHumanFoodResult } from "../validateHumanFoodResult";
import type { HumanFoodRequestExecutionState } from "../requestExecutionState";
import { buildRejectedCandidatePrompt } from "../requestExecutionState";

const CREATOR_DIRECTIVES: Record<HumanFoodCreator, string> = {
  weekly_meal_plan: "Build date-specific weekly meals while preserving the authoritative daily context and validated week-level variety.",
  grocery_coach: "Recommend one practical grocery-ready meal while preserving explicit owned-ingredient intent.",
  fridge_rescue: "Build meals from the user's available ingredients without silently discarding their requested food.",
  buffet: "Build plates only from the foods physically available at the buffet.",
  meal_refinement: "Apply only the requested refinement while preserving the rest of the existing meal.",
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