import {
  buildPediatricImageContext,
  isFallbackMealImage,
  pediatricImageSource,
  recipeImageStatus,
  type PediatricImageGeneration,
} from "@shared/pediatricMealImage";

interface RecipeImageInput {
  recipe: {
    recipeName: string;
    ingredients?: Array<string | { name?: string; item?: string }>;
    textureAndChokingPreparation?: string;
    _imageGeneration?: PediatricImageGeneration;
    [key: string]: any;
  };
  imageUrl?: string | null;
  imageGeneration?: PediatricImageGeneration;
  resolverMeta?: { stageKey?: string; textureClass?: string; activeConditionIds?: string[] } | null;
  resolverContext?: { textureStrategy?: string; presentationStrategy?: string } | null;
}

/** One shared client policy for initial delivery and saved-recipe restoration.
 * A contextual failure is terminal for this recipe; a legacy placeholder is not a photo.
 * The caller owns in-flight deduplication for restoration (including StrictMode replay).
 */
export async function resolvePediatricRecipeImage(
  input: RecipeImageInput,
  stageKey: string,
  occasion: string | undefined,
  request: (body: Record<string, unknown>) => Promise<{ imageUrl?: string | null }>,
) {
  const prior = input.imageGeneration ?? input.recipe._imageGeneration;
  let imageUrl = input.imageUrl ?? prior?.fallbackUrl ?? null;
  if (imageUrl && !isFallbackMealImage(imageUrl)) {
    return { recipe: input.recipe, imageUrl, imageStatus: recipeImageStatus(imageUrl) };
  }
  if (prior?.attemptedWithPediatricContext &&
      (prior.status !== "generated" || prior.automaticRepairAttempted)) {
    return { recipe: input.recipe, imageUrl, imageStatus: recipeImageStatus(imageUrl) };
  }

  const pediatricContext = prior?.pediatricContext ?? buildPediatricImageContext({
    stageKey: input.resolverMeta?.stageKey ?? stageKey,
    textureClass: input.resolverMeta?.textureClass,
    ...input.resolverContext,
    textureAndChokingPreparation: input.recipe.textureAndChokingPreparation,
    activeConditionIds: input.resolverMeta?.activeConditionIds,
  });
  const sourceType = prior?.sourceType ?? pediatricImageSource(occasion);
  try {
    const result = await request({
      mealName: input.recipe.recipeName,
      ingredients: input.recipe.ingredients ?? [],
      mealType: sourceType,
      sourceType,
      pediatricContext,
    });
    imageUrl = result.imageUrl ?? imageUrl;
  } catch {
    // Keep an existing illustration on a failed legacy repair, without a second request.
  }
  const status = recipeImageStatus(imageUrl);
  const generation: PediatricImageGeneration = {
    pediatricContext, sourceType, status, attemptedWithPediatricContext: true,
    automaticRepairAttempted: true,
    ...(isFallbackMealImage(imageUrl) ? { fallbackUrl: imageUrl! } : {}),
  };
  return {
    recipe: { ...input.recipe, _imageGeneration: generation },
    imageUrl,
    imageStatus: status,
  };
}

/** Illustrations remain displayable but are never persisted as generated photographs. */
export function pediatricImageForSave(url?: string | null): string | null {
  return !url || isFallbackMealImage(url) || url.startsWith("data:") ? null : url;
}

/** Page-scoped (never global): same saved recipe joins one request and one save. */
export function createPediatricImageRestorer() {
  const requests = new Map<string, ReturnType<typeof resolvePediatricRecipeImage>>();
  return (
    key: string,
    input: RecipeImageInput,
    stageKey: string,
    request: Parameters<typeof resolvePediatricRecipeImage>[3],
    save: (result: Awaited<ReturnType<typeof resolvePediatricRecipeImage>>) => Promise<unknown>,
  ) => {
    let pending = requests.get(key);
    if (!pending) {
      pending = resolvePediatricRecipeImage(input, stageKey, undefined, request).then(async result => {
        if (result.recipe !== input.recipe) {
          await save(result).catch(() => {});
        }
        return result;
      });
      requests.set(key, pending);
    }
    return pending;
  };
}
