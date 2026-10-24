import { isVerifiedPhotograph, legacyPhotographUrl, type ImageResult } from "../../shared/imageResult";
import {
  DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
  resolveMealImageStorageContext,
} from "./mealImageBucket";

export interface DevelopmentMealImageUrlEnvironment {
  NODE_ENV?: string;
  DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS?: string;
  REPLIT_DEV_DOMAIN?: string;
  MEAL_IMAGE_STORAGE_ENV?: string;
  DEFAULT_OBJECT_STORAGE_BUCKET_ID?: string;
}

function runtimeEnvironment(): DevelopmentMealImageUrlEnvironment {
  return {
    NODE_ENV: process.env.NODE_ENV,
    DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS: process.env.DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS,
    REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
    MEAL_IMAGE_STORAGE_ENV: process.env.MEAL_IMAGE_STORAGE_ENV,
    DEFAULT_OBJECT_STORAGE_BUCKET_ID: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID,
  };
}

/**
 * Prepared, not activated. Only the runtime-managed workspace hostname is
 * trusted; request Host/Forwarded headers and Production app URL settings are
 * deliberately not inputs. Published (NODE_ENV=production) runtimes stay inert.
 */
export function developmentMealImagePublicOrigin(
  env: DevelopmentMealImageUrlEnvironment = runtimeEnvironment(),
): string | null {
  if (env.NODE_ENV !== "development" || env.DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS !== "true") {
    return null;
  }
  resolveMealImageStorageContext({
    nodeEnv: env.NODE_ENV,
    storageEnvironment: env.MEAL_IMAGE_STORAGE_ENV ?? "development",
    configuredBucketId: env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
  });
  const domain = env.REPLIT_DEV_DOMAIN;
  if (!domain) throw new Error("Development meal images require REPLIT_DEV_DOMAIN");
  const url = new URL(`https://${domain}`);
  if (
    url.host !== domain || !url.hostname.endsWith(".replit.dev") ||
    url.hostname.includes("..") || url.username || url.password ||
    url.port || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("Development meal images require a runtime-managed HTTPS Development hostname");
  }
  return url.origin;
}

function canonicalPath(url: string, origin: string): string {
  // Accept our own transport form on a round trip, but never another host,
  // another bucket, a protocol-relative URL, or a normalized/traversing path.
  const path = url.startsWith(`${origin}/`) ? url.slice(origin.length) : url;
  const prefix = `/public-objects/${DEVELOPMENT_MEAL_IMAGE_BUCKET_ID}/meal-images/`;
  if (!path.startsWith(prefix) || path.length === prefix.length) {
    throw new Error("Development photograph URL is outside the active meal-image path");
  }
  const resolved = new URL(path, origin);
  if (resolved.origin !== origin || `${resolved.pathname}${resolved.search}${resolved.hash}` !== path) {
    throw new Error("Development photograph URL must preserve its exact object path");
  }
  return path;
}

/** Restore only our exact transport URLs before existing save/authority logic. */
export function canonicalDevelopmentMealImageUrl(
  url: string,
  env: DevelopmentMealImageUrlEnvironment = runtimeEnvironment(),
): string {
  // Relative and unrelated historical references must not even consult config.
  if (!url.startsWith("https://")) return url;
  const origin = developmentMealImagePublicOrigin(env);
  if (!origin || !url.startsWith(`${origin}/public-objects/`)) return url;
  return canonicalPath(url, origin);
}

/**
 * Copy at the HTTP boundary, never in the generator/cache/storage path.
 * Image evidence is not upgraded: failed/unverified photographs have no
 * deliverable URL, and a mismatched result cannot become a legacy success.
 */
export function serializeGeneratedMealPhotograph<
  T extends { url: string | null; imageResult: ImageResult },
>(
  image: T,
  env: DevelopmentMealImageUrlEnvironment = runtimeEnvironment(),
): T {
  const origin = developmentMealImagePublicOrigin(env);
  if (!origin) return image;
  if (!isVerifiedPhotograph(image.imageResult)) {
    return {
      ...image, url: null,
      imageResult: {
        ...image.imageResult, url: null,
        display: image.imageResult.display === "photograph" ? "none" : image.imageResult.display,
      },
    };
  }
  if (image.url !== image.imageResult.url) {
    return {
      ...image, url: null,
      imageResult: { ...image.imageResult, url: null, display: "none", reason: "image_url_contract_mismatch" },
    };
  }
  const url = `${origin}${canonicalPath(image.url!, origin)}`;
  return { ...image, url, imageResult: { ...image.imageResult, url } };
}

export function generatedMealPhotographResponse(
  image: { url: string | null; imageResult: ImageResult },
  env: DevelopmentMealImageUrlEnvironment = runtimeEnvironment(),
): { imageUrl: string | null; imageResult: ImageResult } {
  const serialized = serializeGeneratedMealPhotograph(image, env);
  return { imageUrl: legacyPhotographUrl(serialized.imageResult), imageResult: serialized.imageResult };
}
