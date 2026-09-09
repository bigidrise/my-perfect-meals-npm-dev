/**
 * Masks non-animal compound ingredients before word-level dietary scans.
 * Dish titles are intentionally not handled here: only structured ingredient
 * names or verified labels are valid ingredient-presence evidence.
 */
export function maskNonAnimalDietaryCompounds(value: string): string {
  const plantSources =
    "(?:almond|cashew|coconut|flax|hemp|oat|pea|peanut|rice|soy|sunflower|seed|nut|cocoa)";
  const nonAnimalQualifier =
    `(?:${plantSources}|plant[ -]?based|dairy[ -]?free|non[ -]?dairy|vegan)`;

  return value
    .toLowerCase()
    .replace(
      new RegExp(`\\b${nonAnimalQualifier}\\s+cream\\s+cheese\\b`, "gi"),
      "__non_animal_compound__",
    )
    .replace(
      new RegExp(`\\b${nonAnimalQualifier}\\s+(milk|cream|butter|cheese)\\b`, "gi"),
      "__non_animal_compound__",
    )
    .replace(
      /\b(almond|cashew|peanut|sunflower|seed|nut)\s+butter\b/gi,
      "__non_animal_compound__",
    );
}

export function structuredIngredientText(
  ingredients: Array<string | { name?: string; item?: string }> | undefined,
  ingredientLabel: string[] = [],
): string {
  return [
    ...(ingredients ?? []).map((ingredient) =>
      typeof ingredient === "string"
        ? ingredient
        : ingredient.name ?? ingredient.item ?? "",
    ),
    ...ingredientLabel,
  ].filter(Boolean).join(" | ");
}