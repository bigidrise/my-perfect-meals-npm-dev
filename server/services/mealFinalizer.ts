/**
 * mealFinalizer — Generic Meal Image Finalization Service
 *
 * Phase 3 of the Unified Meal Image Pipeline.
 *
 * PURPOSE
 * -------
 * Attaches a permanent, MPM-controlled image URL to any already-generated
 * meal object. This is intentionally thin:
 *   - It does NOT generate nutrition or clinical content.
 *   - It does NOT persist the meal. Persistence is the caller's responsibility.
 *   - It does NOT duplicate the Grocery Coach finalizer (mealCardFinalizer.ts),
 *     which additionally saves to savedMeals, builds provenance metadata, etc.
 *
 * Each meal-producing surface retains full ownership of its nutrition rules and
 * persistence strategy. This service only standardises the image step.
 *
 * USAGE
 * -----
 * After a surface has generated its meal data:
 *
 *   const { meal: mealWithImage } = await finalizeMealImage({ meal, sourceType });
 *   // meal.imageUrl is now a permanent /public-objects/ or S3 URL (or null on failure)
 *   // Persist meal as normal — imageUrl will survive reload.
 *
 * CLIENT ENDPOINT
 * ---------------
 * POST /api/meals/finalize  (mounted in server/routes/meals.ts)
 */

import { generateMealImageUnified } from './mealImageGenerator';

// Re-export the ImageSourceType if the generator exports it — otherwise define inline.
type ImageSourceType = 'meal' | 'snack' | 'beverage' | 'dessert';

export interface MealForFinalization {
  id?: string;
  name: string;
  description?: string;
  ingredients?: Array<string | { name?: string; item?: string; [k: string]: unknown }>;
  nutrition?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FinalizeMealImageInput {
  meal: MealForFinalization;
  /**
   * Image source type, used to select the appropriate prompt template inside
   * generateMealImageUnified. Defaults to 'meal'.
   */
  sourceType?: ImageSourceType;
}

export interface FinalizeMealImageResult {
  meal: MealForFinalization & { imageUrl: string | null };
  imageUrl: string | null;
  /**
   * true when imageUrl is a confirmed permanent MPM-controlled URL.
   * false when generation failed (imageUrl === null) or the generator returned
   * a non-permanent fallback path.
   */
  permanent: boolean;
}

const PERMANENT_PREFIXES = ['/public-objects/', '/images/', '/assets/'];

function isPermanent(url: string | null): boolean {
  if (!url) return false;
  return PERMANENT_PREFIXES.some((p) => url.startsWith(p)) || url.includes('amazonaws.com');
}

/**
 * Resolves a generic sourceType from a mealType string.
 * Matches the same logic used in /api/meals/generate-image so callers
 * get consistent prompt selection regardless of which path they use.
 */
export function resolveSourceType(
  mealType: string | undefined,
  mealName: string = '',
): ImageSourceType {
  if (!mealType) return 'meal';
  const mt = mealType.toLowerCase();
  const nameLow = mealName.toLowerCase();
  if (mt === 'snack' || mt === 'snacks') return 'snack';
  if (mt === 'beverage' || mt === 'drink' || mt === 'beverages') return 'beverage';
  if (mt === 'dessert' || mt === 'desserts') return 'dessert';
  if (/smoothie|shake|juice|latte|coffee|tea|cocktail|mocktail|lemonade/.test(nameLow))
    return 'beverage';
  if (/cake|pie|cookie|brownie|pudding|ice cream|cheesecake|tart|mousse|cupcake/.test(nameLow))
    return 'dessert';
  return 'meal';
}

/**
 * Attach a permanent image URL to the provided meal.
 *
 * Returns the enriched meal regardless of whether image generation succeeded.
 * On failure, meal.imageUrl is null and permanent is false; callers should
 * render a fallback and not retry automatically.
 */
export async function finalizeMealImage(
  input: FinalizeMealImageInput,
): Promise<FinalizeMealImageResult> {
  const { meal, sourceType = 'meal' } = input;

  const ingredientStrings = (meal.ingredients ?? []).map((i) => {
    if (typeof i === 'string') return i;
    return (i.name ?? i.item ?? '').toString();
  }).filter(Boolean);

  let imageUrl: string | null = null;

  try {
    imageUrl = await generateMealImageUnified(meal.name, ingredientStrings, sourceType);
  } catch (err) {
    console.warn('[MealFinalizer] Image generation failed for "%s":', meal.name, err);
  }

  return {
    meal: { ...meal, imageUrl },
    imageUrl,
    permanent: isPermanent(imageUrl),
  };
}
