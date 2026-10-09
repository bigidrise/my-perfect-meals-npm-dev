import type { HumanFoodContext } from "../../../shared/humanFoodContext";
import { validateHumanFoodResult } from "./validateHumanFoodResult";

/** Explain only rules that actually failed; never infer a clinical reason. */
export function describeChefFoodProfileFailure(
  violations: readonly string[],
  context: HumanFoodContext,
): string {
  const remaining = context.nutrition?.projectedRemaining ?? context.nutrition?.remaining;
  const exceeded = [
    ["starchy_carb_budget_exceeded", "starchy carbohydrate", context.nutrition?.starch?.consumed?.remainingGrams, "g"],
    ["consumed_starch_budget_exhausted", "starchy carbohydrate", 0, "g"],
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
  }, context, { ordinaryFatAsGuidance: true });
  const remaining = context.nutrition?.prescription?.source === "fallback"
    ? null
    : context.nutrition?.projectedRemaining ?? context.nutrition?.remaining;
  return {
    ...validation,
    error: describeChefFoodProfileFailure(validation.violations, context),
    repairHint: [
      `CANONICAL FOOD PROFILE CHECK FAILED: ${validation.violations.join(", ")}.`,
      remaining
        ? `Ordinary daily goals remaining (${remaining.calories} kcal, ${remaining.carbs}g total carbohydrate, ${remaining.fat}g fat) are guidance, not rejection limits. Preserve strict starchy-carbohydrate allowances and independent clinical and explicitly requested limits.`
        : "Numeric targets remain unavailable; do not fabricate a numeric ceiling.",
      "Preserve the requested dish, cuisine and all allergy, avoidance, dietary and clinical requirements.",
      "Adapt ingredients and preparation only for failed hard requirements; ordinary calorie/fat/protein/total-carbohydrate overages alone do not require shrinking or replacing the requested dish.",
      "Do not merely lower the reported nutrition: change the actual recipe and report honest, complete per-serving nutrition.",
    ].join(" "),
  };
}

/** Forecast only: generating a meal never writes consumption or changes targets. */
export function buildChefMacroGoalNotice(candidate: any, context: HumanFoodContext, servings = 1) {
  const state = context.nutrition;
  if (!state || state.prescription.source === "fallback" ||
      !Number.isFinite(servings) || servings < 1) return undefined;
  const projections = (["fat", "protein"] as const).map(macro => {
    const target = state.prescription[macro === "fat" ? "fatTarget" : "proteinTarget"];
    const before = state.consumed[macro] + state.planned[macro];
    const value = candidate?.nutrition?.[macro] ?? candidate?.[macro];
    const recipe = value == null || (typeof value === "string" && !value.trim())
      ? NaN
      : Number(value) / servings;
    const projected = before + recipe;
    return { macro, target, before, recipe, projected, overage: Math.max(0, projected - target) };
  }).filter(item =>
    [item.target, item.before, item.recipe, item.projected].every(Number.isFinite) &&
    item.target >= 0 && item.recipe >= 0 &&
    item.overage > 0,
  );
  if (!projections.length) return undefined;
  const display = (value: number) => Math.round(value * 10) / 10;
  return {
    basis: "planned_forecast" as const,
    dateISO: state.date,
    projections,
    message: projections.map(item =>
      `One serving contains ${display(item.recipe)}g ${item.macro}. If added to this day's plan, ${item.macro} would total ${display(item.projected)}g against the ${display(item.target)}g goal (${display(item.overage)}g over).`,
    ).join(" ") + " This is macro tracking guidance, not a safety warning.",
  };
}
