import type { HumanFoodContext, HumanFoodCreator } from "../../../../shared/humanFoodContext";
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