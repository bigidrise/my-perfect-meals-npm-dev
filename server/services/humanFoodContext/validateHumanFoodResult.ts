import type { HumanFoodContext } from "../../../shared/humanFoodContext";

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

export function validateHumanFoodResult(
  result: unknown,
  context: HumanFoodContext,
): HumanFoodValidationResult {
  const violations: string[] = [];
  const text = ingredientText(result);

  if (!result || typeof result !== "object") violations.push("result_not_object");
  if (!text) violations.push("ingredients_missing");

  for (const forbidden of [...context.safety.allergies, ...context.safety.avoidedFoods]) {
    const term = normalize(forbidden);
    if (term.length >= 3 && text.includes(term)) {
      violations.push(`forbidden_ingredient:${term}`);
    }
  }

  return { valid: violations.length === 0, violations };
}
