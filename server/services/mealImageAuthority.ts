import { ObjectStorageService, StorageUnavailableError } from "../objectStorage";
import {
  getActiveMealImageBucket,
  publicMealImageUrl,
  resolveMealImageReadBucket,
} from "./mealImageBucket";

export type MealImageAuthorityStatus =
  | { status: "available"; canonicalUrl: string; bucketId: string; objectName: string }
  | { status: "missing"; reason: "invalid" | "inactive" | "missing" }
  | { status: "unavailable"; reason: "storage_unavailable" };

export function parseMealImageObjectUrl(
  url: string | null | undefined,
): { bucketId: string; objectName: string } | null {
  if (!url) return null;
  const match = url.match(
    /^\/public-objects\/(replit-objstore-[0-9a-f-]+)\/(meal-images\/[^?#]+)$/i,
  );
  return match ? { bucketId: match[1], objectName: match[2] } : null;
}

/**
 * A first-party-looking URL is durable only when it resolves through the
 * current environment's configured storage authority and the object exists.
 */
export async function validateMealImageAuthority(
  url: string | null | undefined,
): Promise<MealImageAuthorityStatus> {
  const parsed = parseMealImageObjectUrl(url);
  if (!parsed) return { status: "missing", reason: "invalid" };

  const activeBucket = getActiveMealImageBucket();
  const readBucket = resolveMealImageReadBucket(parsed.bucketId);
  if (readBucket !== activeBucket) {
    return { status: "missing", reason: "inactive" };
  }

  try {
    const resolved = await new ObjectStorageService().resolvePublicObjectPath(
      `${parsed.bucketId}/${parsed.objectName}`,
    );
    if (!resolved) return { status: "missing", reason: "missing" };
    return {
      status: "available",
      canonicalUrl: publicMealImageUrl(parsed.objectName),
      bucketId: resolved.bucketId ?? activeBucket,
      objectName: resolved.objectName,
    };
  } catch (error) {
    if (error instanceof StorageUnavailableError) {
      return { status: "unavailable", reason: "storage_unavailable" };
    }
    throw error;
  }
}