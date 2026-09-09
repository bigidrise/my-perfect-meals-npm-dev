/**
 * Semantic normalization for dietary compound concepts.
 *
 * This is intentionally separate from general token normalization:
 * "milk", "cream", "butter", and "cheese" are animal-product evidence only
 * when they are the actual ingredient concept, not merely the head word of a
 * qualified plant compound. The food category "ice cream" is also not proof
 * that dairy cream is present in a raw dish request.
 */
export function maskNonAnimalDietaryCompounds(value: string): string {
  const plantSources =
    "(?:almond|banana|cashew|cocoa|coconut|flax|hazelnut|hemp|macadamia|nut|oat|pea|peanut|pistachio|pumpkin|quinoa|rice|seed|sesame|soy|sunflower|tiger[ -]?nut|walnut)";
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
      new RegExp(`\\b${plantSources}\\s+butter\\b`, "gi"),
      "__non_animal_compound__",
    );
}

/**
 * Raw requests describe desired food identity, not a verified ingredient list.
 * Mask category compounds here only; never apply this function to generated
 * structured ingredients.
 */
export function maskFoodIntentDietaryCompounds(value: string): string {
  return maskNonAnimalDietaryCompounds(value)
    .replace(/\bice[\s-]+cream\b/gi, "__frozen_dessert_concept__");
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