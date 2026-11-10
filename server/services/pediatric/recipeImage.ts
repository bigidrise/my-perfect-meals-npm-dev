import {
  buildPediatricImageContext,
  isFallbackMealImage,
  pediatricImageSource,
  recipeImageStatus,
  type PediatricImageGeneration,
  type RecipeImageFailure,
  type PediatricImageContext,
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
  manualRetry = false,
  savedVisualContext?: PediatricImageContext,
): Promise<{ imageUrl: string | null; imageGeneration: PediatricImageGeneration }> {
  const pediatricContext = savedVisualContext ?? buildPediatricImageContext({
    ...context,
    textureAndChokingPreparation: recipe.textureAndChokingPreparation,
  });
  const sourceType = pediatricImageSource(occasion);
  let imageUrl: string | null = null;
  let failureCode: RecipeImageFailure | undefined;
  try {
    const name = recipe.recipeName ?? recipe.name;
    if (name) {
      const { generateMealImageUnified } = await import("../mealImageGenerator");
      imageUrl = process.env.NODE_ENV === "development"
        ? await generateMealImageUnified(name, recipe.ingredients ?? [], sourceType, pediatricContext,
          undefined, { manualRetry, onFailure: code => { failureCode = code; } })
        : await generateMealImageUnified(name, recipe.ingredients ?? [], sourceType, pediatricContext);
    }
  } catch (error) {
    failureCode = "unexpected_error";
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
      ...(failureCode ? { failureCode } : {}),
      ...(process.env.NODE_ENV === "development" ? { model: "gpt-image-2.5-flare-2026-09-08" } : {}),
      ...(isFallbackMealImage(imageUrl) ? { fallbackUrl: imageUrl! } : {}),
    },
  };
}
