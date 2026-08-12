// server/services/imageLifecycle.ts
// Canva-style image lifecycle enforcement — all image persistence goes through here.
//
// Phase 4 change: processMealImageForSave now routes through the canonical
// MediaAssetService.  base64 is NEVER written to Postgres.  On upload failure,
// imageUrl is null and mediaAssetId carries the failed record — the meal still
// saves successfully and the image shows as pending.

import { processImageForMeal, isUnsafeImageUrl, warnLifecycleViolation, type MediaAsset } from "./mediaAssetService";

// First-party URL prefixes — always permanent, always safe
const S3_BUCKET = process.env.S3_BUCKET_NAME || "my-perfect-meals-images";
export const FIRST_PARTY_PREFIXES: string[] = [
  "/public-objects/",
  "/images/",
  "/assets/",
  `https://${S3_BUCKET}.s3.`,
];

// Known temporary URL patterns
const TEMP_URL_PATTERNS = ["oaidalleapiprodscus", "blob.core.windows.net", "openai.com"];

export interface ImageValidationResult {
  isFirstParty: boolean;
  needsIngestion: boolean;
  reason: string;
}

export interface ImageIngestionResult {
  success: boolean;
  permanentUrl?: string;
  error?: string;
  status: "ingested" | "pending" | "failed" | "already_permanent";
}

/** Check whether a URL is already a first-party permanent URL. */
export function isFirstPartyImageUrl(url: string | undefined | null): ImageValidationResult {
  if (!url) {
    return { isFirstParty: false, needsIngestion: false, reason: "No image URL provided" };
  }
  if (FIRST_PARTY_PREFIXES.some(p => url.startsWith(p))) {
    return { isFirstParty: true, needsIngestion: false, reason: "URL is first-party" };
  }
  if (TEMP_URL_PATTERNS.some(p => url.includes(p))) {
    return { isFirstParty: false, needsIngestion: true, reason: "URL is a known temporary third-party URL" };
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { isFirstParty: false, needsIngestion: true, reason: "URL is external and needs ingestion" };
  }
  if (url.startsWith("data:")) {
    return { isFirstParty: false, needsIngestion: true, reason: "URL is a base64 data URI" };
  }
  return { isFirstParty: true, needsIngestion: false, reason: "URL appears to be a local relative path" };
}

/**
 * Result returned by processMealImageForSave.
 * Callers MUST store mediaAssetId on the entity row when non-null.
 * They must NEVER persist imageUrl if it is a base64 data URI.
 */
export interface MealImageSaveResult {
  imageUrl: string | null;
  mediaAssetId: string | null;
  mediaAsset: MediaAsset | null;
  imagePending: boolean;
  ingestionAttempted: boolean;
}

/**
 * Process a meal image before persistence.
 *
 * Enforcement rules (Phase 4 hard constraints):
 * 1. base64 data URIs are NEVER written to Postgres — upload always attempted;
 *    on failure, imageUrl is null (not base64).
 * 2. Temporary CDN URLs (DALL-E, etc.) are NEVER stored — upload attempted;
 *    on failure, imageUrl is null.
 * 3. Already-permanent (first-party) URLs are passed through and wrapped in
 *    a media_assets record.
 * 4. All paths produce a mediaAssetId for tracking / retry.
 */
export async function processMealImageForSave(
  imageUrl: string | undefined | null,
  mealName: string,
): Promise<MealImageSaveResult> {
  if (!imageUrl) {
    return { imageUrl: null, mediaAssetId: null, mediaAsset: null, imagePending: false, ingestionAttempted: false };
  }

  // Safety gate: log any attempt to pass unsafe URLs to this function.
  if (isUnsafeImageUrl(imageUrl)) {
    warnLifecycleViolation("processMealImageForSave:input", imageUrl, "detected");
  }

  const asset = await processImageForMeal(imageUrl, mealName);

  // HARD RULE: if the asset URLs are null (failed), return null — not the original base64.
  const safeImageUrl = asset.thumbnailUrl ?? asset.displayUrl ?? null;

  // If the input was first-party and the asset wrapped it, use the original URL.
  const finalImageUrl =
    asset.status === "ready"
      ? (safeImageUrl ?? null)
      : null;

  if (isUnsafeImageUrl(finalImageUrl)) {
    // Absolute last-resort guard — should never happen but emit a violation log.
    warnLifecycleViolation("processMealImageForSave:output", finalImageUrl!, "blocked");
    return {
      imageUrl: null,
      mediaAssetId: asset.id,
      mediaAsset: asset,
      imagePending: true,
      ingestionAttempted: true,
    };
  }

  return {
    imageUrl: finalImageUrl,
    mediaAssetId: asset.id,
    mediaAsset: asset,
    imagePending: asset.status !== "ready",
    ingestionAttempted: asset.status !== "pending",
  };
}

/**
 * @deprecated Kept for backward compatibility with mealImageGenerator.ts.
 * New code should call processMealImageForSave() instead.
 *
 * Routes through the canonical media lifecycle and returns the legacy
 * { success, permanentUrl } shape that mealImageGenerator expects.
 */
export async function ingestImageToPermanentStorage(
  imageUrl: string,
  mealName: string
): Promise<{ success: boolean; permanentUrl: string | null }> {
  try {
    const result = await processMealImageForSave(imageUrl, mealName);
    return {
      success: result.imageUrl !== null,
      permanentUrl: result.imageUrl,
    };
  } catch {
    return { success: false, permanentUrl: null };
  }
}

/**
 * Validate a batch of meals for temporary image URLs.
 */
export function findMealsWithTempImages(meals: Array<{ name?: string; imageUrl?: string }>): Array<{
  name: string;
  imageUrl: string;
  reason: string;
}> {
  return meals
    .filter(m => m.imageUrl && !isFirstPartyImageUrl(m.imageUrl).isFirstParty && isFirstPartyImageUrl(m.imageUrl).needsIngestion)
    .map(m => ({
      name: m.name || "Unknown",
      imageUrl: m.imageUrl!,
      reason: isFirstPartyImageUrl(m.imageUrl).reason,
    }));
}
