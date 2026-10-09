import type { HumanFoodContext } from "../../../shared/humanFoodContext";
import { validateHumanFoodResult } from "./validateHumanFoodResult";

/** Explain only rules that actually failed; never infer a clinical reason. */
export function describeChefFoodProfileFailure(
  violations: readonly string[],
  context: HumanFoodContext,
): string {
  const remaining = context.nutrition?.projectedRemaining ?? context.nutrition?.remaining;
  const exceeded = [
    ["projected_calorie_budget_exceeded", "calorie", remaining?.calories, "kcal"],
    ["projected_carb_budget_exceeded", "carbohydrate", remaining?.carbs, "g"],
    ["projected_fat_budget_exceeded", "fat", remaining?.fat, "g"],
  ] as const;
  const limits = exceeded
    .filter(([code]) => violations.includes(code))
    .map(([, label, amount, unit]) =>
      `${label}${amount == null ? "" : ` (${amount}${unit} remaining)`}`,
    );
  if (limits.length) {
    return `Chef couldn't fit this recipe within the day's remaining ${limits.join(" and ")} allowance. No meal was added. Review the day's planned or logged meals, or request a lighter version.`;
  }
  if (violations.some((code) => code.startsWith("verified_"))) {
    return "Chef couldn't verify the recipe's nutrition within the active food profile. No meal was added.";
  }
  return "Chef couldn't adapt this recipe to satisfy the active food profile's ingredient and nutrition requirements. No meal was added.";
}

/** Candidate nutrition is still per-serving here, before images/response formatting. */
export function validateChefCandidate(
  candidate: unknown,
  context: HumanFoodContext,
) {
  const object = candidate as any;
  const nutrition = object?.nutrition ?? object ?? {};
  // null/blank/negative values are unavailable, not a verified zero. Delegate
  // the resulting missing-value findings and all actual limits to the shared check.
  const numeric = (value: unknown): number => {
    if (value == null || (typeof value === "string" && !value.trim())) return NaN;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : NaN;
  };
  const validation = validateHumanFoodResult({
    ...object,
    nutrition: {
      ...nutrition,
      calories: numeric(nutrition.calories ?? nutrition.kcal),
      carbs: numeric(nutrition.carbs ?? nutrition.carbs_g),
      fat: numeric(nutrition.fat ?? nutrition.fat_g),
    },
  }, context);
  const remaining = context.nutrition?.prescription?.source === "fallback"
    ? null
    : context.nutrition?.projectedRemaining ?? context.nutrition?.remaining;
  return {
    ...validation,
    error: describeChefFoodProfileFailure(validation.violations, context),
    repairHint: [
      `CANONICAL FOOD PROFILE CHECK FAILED: ${validation.violations.join(", ")}.`,
      remaining
        ? `The exact per-serving ceilings remain ${remaining.calories} kcal, ${remaining.carbs}g total carbohydrate, and ${remaining.fat}g fat. Do not exceed any of them.`
        : "Numeric targets remain unavailable; do not fabricate a numeric ceiling.",
      "Preserve the requested dish, cuisine and all allergy, avoidance, dietary and clinical requirements.",
      "Adapt ingredient amounts and preparation to the exact canonical nutrition ceilings already provided.",
      "For excess fat, reduce added oil, butter, cheese and creamy sauces; use a leaner preparation without silently replacing the requested dish.",
      "Do not merely lower the reported nutrition: change the actual recipe and report honest, complete per-serving nutrition.",
    ].join(" "),
  };
}
