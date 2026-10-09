import type { HumanFoodContext, HumanFoodMacroGoalOptions } from "../../../shared/humanFoodContext";
import { validateGlycemicProduce } from "../glycemicProduceValidator";

export interface HumanFoodValidationResult {
  valid: boolean;
  violations: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
}

function ingredientText(result: unknown): string {
  const object = result as any;
  const ingredients = Array.isArray(object?.ingredients) ? object.ingredients : [];
  return normalize(
    ingredients
      .map((item: any) =>
        typeof item === "string" ? item : item?.name ?? item?.item ?? "",
      )
      .join(" | "),
  );
}

function finiteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function validateHumanFoodResult(
  result: unknown,
  context: HumanFoodContext,
  options: { requireNutrition?: boolean } & HumanFoodMacroGoalOptions = {},
): HumanFoodValidationResult {
  const violations: string[] = [];
  const text = ingredientText(result);

  if (!result || typeof result !== "object") violations.push("result_not_object");
  if (!text) violations.push("ingredients_missing");

  const authorizedAvoidanceTerms = new Set(
    context.authorization.status === "authorized"
      ? context.authorization.waivers
          .filter((waiver) => waiver.dimension === "avoidance")
          .map((waiver) => normalize(waiver.matchedTerm))
      : [],
  );
  // Allergies are never waivable. An acknowledgement can waive only the exact
  // avoidance term that the server bound to this action.
  for (const forbidden of [
    ...context.safety.allergies,
    ...context.safety.avoidedFoods.filter((food) => !authorizedAvoidanceTerms.has(normalize(food))),
  ]) {
    const term = normalize(forbidden);
    if (term.length >= 3 && text.includes(term)) {
      violations.push(`forbidden_ingredient:${term}`);
    }
  }

  const object = result as any;
  if (context.diabetesFoodPreferences) {
    const glucose = context.diabetesFoodPreferences;
    const produce = validateGlycemicProduce({
      ingredients: Array.isArray(object?.ingredients)
        ? object.ingredients.map((item: any) => typeof item === "string" ? item : item?.name ?? item?.item ?? "")
        : [],
      activePreferences: [...glucose.selectedFruits, ...glucose.selectedVegetables],
      preferencesConfigured: glucose.preferencesConfigured,
      glucoseState: glucose.state,
      safeLowGlucoseOverrides: glucose.safetyOverride.active
        ? glucose.safetyOverride.allowedProduce
        : [],
    });
    violations.push(...produce.violations.map((item) =>
      `glucose_produce_not_allowed:${normalize(item.canonical)}`,
    ));
  }
  const nutrition = object?.nutrition ?? object ?? {};
  const calories = finiteNumber(nutrition.calories ?? nutrition.kcal);
  const carbs = finiteNumber(nutrition.carbs ?? nutrition.carbs_g);
  const fat = finiteNumber(nutrition.fat ?? nutrition.fat_g);
  const starchyCarbs = finiteNumber(nutrition.starchyCarbs ?? nutrition.starchy_carbs);
  const requireNutrition = options.requireNutrition !== false;
  if (requireNutrition && context.nutrition && calories == null) violations.push("verified_calories_missing");
  if (requireNutrition && context.nutrition && carbs == null) violations.push("verified_carbs_missing");
  if (requireNutrition && context.nutrition && fat == null) violations.push("verified_fat_missing");
  // Daily macro goals are tracking guidance, not safety limits. Clinical and
  // explicitly requested restrictions are enforced by their own authorities.
  const consumedStarch = context.nutrition?.starch?.consumed;
  const starchRemaining = consumedStarch?.remainingGrams;
  const hasStarchBudget = typeof starchRemaining === "number" &&
    Number.isFinite(starchRemaining) && starchRemaining >= 0;
  const starchExhausted = context.nutrition?.activeConstraints.consumedStarchExhausted;
  if (requireNutrition && (starchExhausted || hasStarchBudget)) {
    if (starchyCarbs == null) {
      violations.push("verified_starchy_carbs_missing");
    } else if (starchExhausted && starchyCarbs > 0) {
      violations.push("consumed_starch_budget_exhausted");
    } else if (hasStarchBudget && starchyCarbs > starchRemaining) {
      violations.push("starchy_carb_budget_exceeded");
    }
  }

  return { valid: violations.length === 0, violations };
}
