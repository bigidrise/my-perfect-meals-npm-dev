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
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / servingCount : value;
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