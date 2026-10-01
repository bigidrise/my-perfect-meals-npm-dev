export interface MealRefinementContext {
  builderType?: string;
  proClientId?: string;
}

export function mealRefinementContextPayload(
  builderType?: string,
  proClientId?: string,
): MealRefinementContext {
  return {
    ...(builderType ? { builderType } : {}),
    ...(proClientId ? { proClientId } : {}),
  };
}