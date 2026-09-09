import type { HumanFoodContext } from "../../../shared/humanFoodContext";
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
  const remaining = context.nutrition?.prescription?.source === "fallback"
    ? null
    : context.nutrition?.projectedRemaining ?? context.nutrition?.remaining;
  const calories = finiteNumber(nutrition.calories ?? nutrition.kcal);
  const carbs = finiteNumber(nutrition.carbs ?? nutrition.carbs_g);
  const fat = finiteNumber(nutrition.fat ?? nutrition.fat_g);
  const starchyCarbs = finiteNumber(nutrition.starchyCarbs ?? nutrition.starchy_carbs);
  if (context.nutrition && calories == null) violations.push("verified_calories_missing");
  if (context.nutrition && carbs == null) violations.push("verified_carbs_missing");
  if (context.nutrition && fat == null) violations.push("verified_fat_missing");
  if (remaining && calories != null && calories > remaining.calories) {
    violations.push("projected_calorie_budget_exceeded");
  }
  if (remaining && carbs != null && carbs > remaining.carbs) {
    violations.push("projected_carb_budget_exceeded");
  }
  if (remaining && fat != null && fat > remaining.fat) {
    violations.push("projected_fat_budget_exceeded");
  }
  if (context.nutrition?.activeConstraints.consumedStarchExhausted) {
    if (starchyCarbs == null) {
      violations.push("verified_starchy_carbs_missing");
    } else if (starchyCarbs > 0) {
      violations.push("consumed_starch_budget_exhausted");
    }
  }

  return { valid: violations.length === 0, violations };
}
