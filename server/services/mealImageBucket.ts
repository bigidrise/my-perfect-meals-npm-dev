/**
 * The single authoritative Object Storage bucket for permanent meal images.
 *
 * Retired bucket IDs are accepted only when resolving pre-existing URLs. They
 * must never be selected for a new upload or emitted in a new public URL.
 */
export const MEAL_IMAGE_BUCKET_ID =
  "replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491";

export const LEGACY_MEAL_IMAGE_BUCKET_IDS = new Set([
  "replit-objstore-e02a723e-40e9-4d89-9c0e-05adfa185d2d",
  "replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b",
]);

/**
 * Repoint only known retired meal-image buckets. Unknown bucket IDs are left
 * untouched so a bad URL cannot silently read a different object's contents.
 */
export function resolveMealImageReadBucket(bucketId: string): string {
  return LEGACY_MEAL_IMAGE_BUCKET_IDS.has(bucketId)
    ? MEAL_IMAGE_BUCKET_ID
    : bucketId;
}

export function assertCanonicalMealImageWriteBucket(bucketId: string): string {
  if (bucketId !== MEAL_IMAGE_BUCKET_ID) {
    throw new Error("Legacy or unknown bucket cannot be used for meal-image writes");
  }
  return bucketId;
}

export function publicMealImageUrl(objectName: string): string {
  return `/public-objects/${MEAL_IMAGE_BUCKET_ID}/${objectName}`;
}