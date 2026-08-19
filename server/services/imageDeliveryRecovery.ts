/**
 * Policy helpers for repairing delivery of first-party meal images.
 *
 * A browser image error does not include an HTTP status. The recovery endpoint
 * re-probes Object Storage so it can distinguish a missing object (404) from
 * a retryable storage failure (503) before deciding whether to reuse a stored
 * variant or mark the media asset unavailable.
 */

export const IMAGE_DELIVERY_RETRY_LIMIT = 1;

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