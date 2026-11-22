/** A stored snapshot, never a request to regenerate any part of a recipe. */
export interface PreparationGuide {
  title: string;
  sections: Array<{ heading: string; text: string }>;
}

export interface RecipePackage<TMeal = { name: string; [key: string]: unknown }> {
  version: 1;
  id: string;
  source: string;
  preparationGuide: PreparationGuide;
  meals: TMeal[];
  servings: number;
}

export function isPreparationGuide(value: unknown): value is PreparationGuide {
  const guide = value as PreparationGuide | null;
  return !!guide && typeof guide.title === "string" && Array.isArray(guide.sections)
    && guide.sections.every(section => !!section
      && typeof section.heading === "string" && typeof section.text === "string");
}

/** Keep the first recipe at the legacy root; retain ALL recipes verbatim inside. */
export function savedRecipePackage<TMeal extends { name: string }>(
  recipePackage: RecipePackage<TMeal>,
  sourceType: string,
) {
  const snapshot = {
    ...recipePackage,
    meals: recipePackage.meals.map(meal => ({
      ...meal,
      servings: ("servings" in meal ? meal.servings : undefined) ?? recipePackage.servings,
    })),
  };
  return {
    title: snapshot.preparationGuide.title,
    sourceType,
    mealData: {
      ...snapshot.meals[0],
      servings: snapshot.meals[0]?.servings ?? snapshot.servings,
      recipePackage: snapshot,
    },
  };
}

export function readRecipePackage(mealData: unknown): RecipePackage | null {
  const value = (mealData as { recipePackage?: RecipePackage } | null)?.recipePackage;
  return value?.version === 1 && typeof value.id === "string"
    && isPreparationGuide(value.preparationGuide)
    && Array.isArray(value.meals)
    && value.meals.every(meal => meal && typeof meal.name === "string")
    ? value : null;
}

/** Separate two generated experiences even when their guide titles are equal. */
export function savedMealFavoriteKey(title: string, sourceType: string, packageId?: string) {
  const key = `${(title || "").trim().toLowerCase()}|${sourceType}`;
  return packageId ? `${key}|recipe-package:${packageId}` : key;
}
