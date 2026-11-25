/**
 * Generated meal nutrition starts as one-serving nutrition. The response
 * formatter scales it to total-recipe nutrition for the requested serving
 * count. Every person-specific validator must convert those response totals
 * back to per-serving values before applying per-serving limits.
 */
export function perServingNumber(
  value: unknown,
  servingCount: number,
): unknown {
  if (!Number.isInteger(servingCount) || servingCount <= 0) return NaN;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" &&
      (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim()))) return NaN;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0
    ? numeric / servingCount
    : NaN;
}

export function toPerServingNutrition(
  meal: any,
  servingCount: number,
) {
  return {
    calories: perServingNumber(
      meal.nutrition?.calories ?? meal.calories,
      servingCount,
    ),
    protein: perServingNumber(
      meal.nutrition?.protein ?? meal.protein,
      servingCount,
    ),
    carbs: perServingNumber(
      meal.nutrition?.carbs ?? meal.carbs,
      servingCount,
    ),
    fat: perServingNumber(
      meal.nutrition?.fat ?? meal.fat,
      servingCount,
    ),
    starchyCarbs: perServingNumber(
      meal.nutrition?.starchyCarbs ?? meal.starchyCarbs,
      servingCount,
    ),
  };
}