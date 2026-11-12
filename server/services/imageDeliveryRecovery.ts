/**
 * Policy helpers for repairing delivery of first-party meal images.
 *
 * A browser image error does not include an HTTP status. The recovery endpoint
 * re-probes Object Storage so it can distinguish a missing object (404) from
 * a retryable storage failure (503) before deciding whether to reuse a stored
 * variant for this view. A delivery probe must not change shared media state.
 */

export const IMAGE_DELIVERY_RETRY_LIMIT = 1;

/**
 * A previous delivery miss is not a processing failure or proof that bytes are
 * still missing. Let the browser retry the same owned, permanent references.
 * Never revive failed ingestion, pending assets, or a canonical asset's JSON
 * fallback; actual delivery failure remains bounded by MealImageSlot.
 */
export function savedMealImageUrls(row: {
  mediaAssetId?: string | null;
  assetStatus?: string | null;
  assetProcessingError?: string | null;
  assetThumbnailUrl?: string | null;
  assetDisplayUrl?: string | null;
  mealData?: unknown;
}): { thumbnailUrl: string | null; displayUrl: string | null } {
  if (!row.mediaAssetId) {
    const data = row.mealData;
    const raw = data && typeof data === "object" && "imageUrl" in data
      ? data.imageUrl : null;
    const legacy = typeof raw === "string" && raw && !raw.startsWith("data:") &&
      !raw.includes("oaidalleapiprodscus") ? raw : null;
    return { thumbnailUrl: legacy, displayUrl: legacy };
  }
  if (row.assetStatus === "ready") {
    return {
      thumbnailUrl: row.assetThumbnailUrl ?? null,
      displayUrl: row.assetDisplayUrl ?? null,
    };
  }
  if (row.assetStatus === "failed" && row.assetProcessingError === "delivery_missing") {
    const retryable = (url: string | null | undefined) =>
      url && isRecoverableObjectStorageUrl(url) ? url : null;
    return {
      thumbnailUrl: retryable(row.assetThumbnailUrl),
      displayUrl: retryable(row.assetDisplayUrl),
    };
  }
  return { thumbnailUrl: null, displayUrl: null };
}

export type DeliveryProbe = "available" | "missing" | "unavailable";

export type DeliveryRecoveryDecision =
  | { status: "retry"; imageUrl: string }
  | { status: "recovered"; imageUrl: string }
  | { status: "unavailable"; reason: "missing" | "unsupported" };

/** Only Object Storage URLs have a server-side, first-party recovery path. */
export function isRecoverableObjectStorageUrl(url: string): boolean {
  // New URLs embed the bucket ID; older valid URLs rely on the configured
  // search path. Both are served by ObjectStorageService and need the same
  // 404-vs-503 recovery behavior.
  return /^\/public-objects\/.+/.test(url);
}

/** Turn an application Object Storage URL into the path used by the resolver. */
export function publicObjectPathFromUrl(url: string): string | null {
  if (!isRecoverableObjectStorageUrl(url)) return null;
  return url.slice("/public-objects/".length);
}

/**
 * Rebuild an Object Storage URL for a different variant in the same bucket.
 * media_assets stores the original key, while its public URLs identify the
 * bucket. Keeping the bucket from the known asset avoids guessing a bucket.
 */
export function publicObjectUrlForKey(referenceUrl: string, objectKey: string | null | undefined): string | null {
  if (!objectKey) return null;
  const match = referenceUrl.match(/^\/public-objects\/(replit-objstore-[^/]+)\//);
  return match ? `/public-objects/${match[1]}/${objectKey}` : null;
}

/**
 * Select a bounded next action after probing a browser-reported image failure.
 *
 * A storage outage can be retried once. A confirmed missing primary image can
 * be replaced only with an existing, validated variant — never a new DALL-E
 * image and never a photo of a different meal.
 */
export function decideImageDeliveryRecovery(input: {
  failedUrl: string;
  failedProbe: DeliveryProbe;
  alternate?: { url: string; probe: DeliveryProbe } | null;
}): DeliveryRecoveryDecision {
  if (!isRecoverableObjectStorageUrl(input.failedUrl)) {
    return { status: "unavailable", reason: "unsupported" };
  }

  // The object exists again, or Object Storage could not be reached. Both are
  // retryable; the client has a strict one-retry limit.
  if (input.failedProbe === "available" || input.failedProbe === "unavailable") {
    return { status: "retry", imageUrl: input.failedUrl };
  }

  // The reported object is confirmed missing. Prefer an existing alternate
  // variant over regeneration, which avoids paid work when the source asset
  // still exists in Object Storage.
  if (input.alternate?.probe === "available") {
    return { status: "recovered", imageUrl: input.alternate.url };
  }
  if (input.alternate?.probe === "unavailable") {
    return { status: "retry", imageUrl: input.alternate.url };
  }

  return { status: "unavailable", reason: "missing" };
}