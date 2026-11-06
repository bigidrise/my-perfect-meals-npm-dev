import { validateAntiInflammatoryMeal } from "../guardrails/validators/antiInflammatoryValidator";

type Food = {
  name?: string;
  ingredients?: readonly (string | { name?: string; item?: string })[] | null;
  instructions?: string | readonly string[];
};

/** Adapter to the existing ingredient rules, not a second nutrition standard.
 * Dish titles are not ingredient evidence (e.g. a safe adaptation of a fried dish).
 * No automatic substitutions: every replacement still needs allergy, dietary,
 * primary-program and clinical validation by its caller. */
export function optionalAntiInflammatoryViolations(food: Food, active: boolean): string[] {
  if (!active) return [];
  const ingredients = (food.ingredients ?? []).map(item => ({
    name: typeof item === "string" ? item.trim() : (item.name ?? item.item ?? "").trim(),
  })).filter(item => item.name);
  if (!ingredients.length) {
    return ["Ingredient details are required to verify optional Anti-Inflammatory support."];
  }
  return validateAntiInflammatoryMeal({
    name: "",
    ingredients,
    instructions: Array.isArray(food.instructions) ? [...food.instructions] : food.instructions as string | undefined,
  }).violations;
}
