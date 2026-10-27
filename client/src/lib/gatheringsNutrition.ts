import { hasGatheringsNutrition } from "@shared/gatheringsNutrition";
import { creatorMealNutrition } from "./mealMacroSnapshot";
import { gatheringsNutritionPilot } from "./gatheringsNutritionGate";
export { gatheringsNutritionPilot };
/** Preserve legacy behavior outside this explicitly Development-only pilot. */
export function canUseGatheringsNutrition(course: unknown, pilot = gatheringsNutritionPilot): boolean {
  return !pilot || hasGatheringsNutrition(course);
}
/** Legacy board button copies top-level macros and drops yield. Supply one
 * eating portion explicitly, while retaining recipe quantities in the card. */
export function gatheringsMealForPlan(course: any) {
  if (!hasGatheringsNutrition(course)) return null;
  const portion = creatorMealNutrition(course);
  return {
    ...course, calories: portion.calories, protein: portion.protein,
    carbs: portion.carbs, fat: portion.fat,
    description: `${course.description ?? ""} Recipe makes ${course.servings} servings; nutrition is for one serving.`,
  };
}
