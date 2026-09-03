/**
 * DEV and production deliberately use separate writable Object Storage buckets.
 * The runtime storage context below is the sole authority for new meal-image
 * writes and public URLs.
 */
export const DEVELOPMENT_MEAL_IMAGE_BUCKET_ID =
  "replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b";

export const PRODUCTION_MEAL_IMAGE_BUCKET_ID =
  "replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491";

export const LEGACY_PRODUCTION_MEAL_IMAGE_BUCKET_IDS = new Set([
  "replit-objstore-e02a723e-40e9-4d89-9c0e-05adfa185d2d",
  DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
]);

export interface MealImageStorageContext {
  environment: "development" | "production";
  bucketId: string;
}

export interface MealImageStorageContextInput {
  nodeEnv?: string;
  configuredBucketId?: string;
}

/**
 * Resolve the only bucket allowed to receive new meal-image writes.
 *
 * Production fails closed unless its explicit configuration points at the
 * canonical production bucket. Development always uses its attached bucket,
 * so a misplaced shared secret cannot make DEV mutate production images.
 */
export function resolveMealImageStorageContext(
  input: MealImageStorageContextInput = {},
): MealImageStorageContext {
  const isProduction = (input.nodeEnv ?? process.env.NODE_ENV) === "production";
  const configuredBucketId =
    input.configuredBucketId ?? process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

  if (isProduction) {
    if (configuredBucketId !== PRODUCTION_MEAL_IMAGE_BUCKET_ID) {
      throw new Error(
        "Production meal-image storage must be explicitly configured with the canonical production bucket",
      );
    }
    return { environment: "production", bucketId: PRODUCTION_MEAL_IMAGE_BUCKET_ID };
  }

  return { environment: "development", bucketId: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID };
}

export function getActiveMealImageBucket(): string {
  return resolveMealImageStorageContext().bucketId;
}

/**
 * Repoint historical production URLs only. DEV must preserve its own bucket
 * URLs so development tests never read from production storage.
 */
export function resolveMealImageReadBucket(
  bucketId: string,
  context: MealImageStorageContext = resolveMealImageStorageContext(),
): string {
  return (
    context.environment === "production" &&
    LEGACY_PRODUCTION_MEAL_IMAGE_BUCKET_IDS.has(bucketId)
  )
    ? PRODUCTION_MEAL_IMAGE_BUCKET_ID
    : bucketId;
}

export function assertActiveMealImageWriteBucket(
  bucketId: string,
  context: MealImageStorageContext = resolveMealImageStorageContext(),
): string {
  if (bucketId !== context.bucketId) {
    throw new Error(
      "Meal-image writes must use the active bucket for the current environment",
    );
  }
  return bucketId;
}

export function publicMealImageUrl(
  objectName: string,
  context: MealImageStorageContext = resolveMealImageStorageContext(),
): string {
  return `/public-objects/${context.bucketId}/${objectName}`;
}