/**
 * Generation is per serving; the response is total-recipe nutrition.
 * Keep the same evidence and precedence used by toPerServingNutrition.
 * Missing evidence stays missing, including starch (never fabricate zero).
 */
export function formatCreatorNutrition(meal: any, servings: number) {
  if (!Number.isInteger(servings) || servings < 1) {
    throw new Error("Recipe serving count must be a positive integer.");
  }
  const fields = [
    "calories", "protein", "carbs", "fat", "starchyCarbs", "fibrousCarbs",
  ] as const;
  return Object.fromEntries(fields.flatMap((field) => {
    const value = meal.nutrition?.[field] ?? meal[field];
    if (value == null) return [];
    const numeric = typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() ? Number(value) : NaN;
    const scaled = numeric * servings;
    return Number.isFinite(scaled) ? [[field, scaled]] : [];
  }));
}
