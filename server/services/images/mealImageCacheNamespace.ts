import { resolveMealImageStorageContext, type MealImageStorageContext } from "../mealImageBucket";

// Existing Production keys are exactly 32 hexadecimal characters. A literal,
// non-hex prefix makes the Development keyspace disjoint, not just unlikely
// to collide. The database primary key is text, so no migration is needed.
export const DEVELOPMENT_MEAL_IMAGE_CACHE_PREFIX = "dev-meal-image:v1:";

export function namespaceMealImageCacheKey(
  legacyDigest: string,
  context: MealImageStorageContext = resolveMealImageStorageContext(),
): string {
  if (!/^[a-f0-9]{32}$/.test(legacyDigest)) {
    throw new Error("Meal-image cache identity must be a canonical 32-character digest");
  }
  return context.environment === "development"
    ? `${DEVELOPMENT_MEAL_IMAGE_CACHE_PREFIX}${legacyDigest}`
    : legacyDigest;
}
