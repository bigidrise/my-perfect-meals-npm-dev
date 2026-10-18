import {
  buildPediatricImageContext,
  isFallbackMealImage,
  pediatricImageSource,
  recipeImageStatus,
  type PediatricImageGeneration,
} from "../../../shared/pediatricMealImage";

/** Uses only the already validated recipe and resolved visual context.
 * One pipeline call; the shared generator owns deduplication, validation, bounded retries and storage.
 */
export async function generatePediatricRecipeImage(
  recipe: {
    recipeName?: string;
    name?: string;
    ingredients?: Array<string | Record<string, any>>;
    textureAndChokingPreparation?: string;
  },
  context: Parameters<typeof buildPediatricImageContext>[0],
  occasion?: string,
): Promise<{ imageUrl: string | null; imageGeneration: PediatricImageGeneration }> {
  const pediatricContext = buildPediatricImageContext({
    ...context,
    textureAndChokingPreparation: recipe.textureAndChokingPreparation,
  });
  const sourceType = pediatricImageSource(occasion);
  let imageUrl: string | null = null;
  try {
    const name = recipe.recipeName ?? recipe.name;
    if (name) {
      const { generateMealImageUnified } = await import("../mealImageGenerator");
      imageUrl = await generateMealImageUnified(
        name, recipe.ingredients ?? [], sourceType, pediatricContext,
      );
    }
  } catch (error) {
    console.warn("[MPB image] Contextual image attempt failed; no automatic second attempt", {
      error: error instanceof Error ? error.name : "unknown",
    });
  }
  return {
    imageUrl,
    imageGeneration: {
      pediatricContext,
      sourceType,
      status: recipeImageStatus(imageUrl),
      attemptedWithPediatricContext: true,
      ...(isFallbackMealImage(imageUrl) ? { fallbackUrl: imageUrl! } : {}),
    },
  };
}
