// server/services/mediaAssetService.ts
// Canonical Media Asset Service — the ONLY path through which images enter permanent storage.
//
// Architecture contract:
//   source image (base64 | temp URL | permanent URL)
//     → download/decode bytes
//     → generate thumbnail (~400px JPEG) + display variant (~1000px JPEG)
//     → upload all variants to Replit Object Storage
//     → insert media_assets record with status = 'ready'
//     → return { id, thumbnailUrl, displayUrl }
//
// On failure: insert media_assets record with status = 'failed', return null URLs.
// NEVER returns base64 as imageUrl for DB storage.

import sharp from "sharp";
import { Client as ReplitStorageClient } from "@replit/object-storage";
import { db } from "../db";
import { mediaAssets } from "../db/schema/mediaAssets";
import crypto from "crypto";

// ── Variant dimensions ───────────────────────────────────────────────────────
const THUMB_WIDTH    = 400;   // px  — card / list views
const DISPLAY_WIDTH  = 1000;  // px  — meal detail / Chef's Kitchen

// ── Permanent first-party URL prefixes ────────────────────────────────────────
const S3_BUCKET = process.env.S3_BUCKET_NAME || "my-perfect-meals-images";
const FIRST_PARTY_PREFIXES: string[] = [
  "/public-objects/",
  "/images/",
  "/assets/",
  `https://${S3_BUCKET}.s3.`,
];

// ── Temporary provider patterns (never store in DB) ───────────────────────────
const TEMP_URL_PATTERNS = ["oaidalleapiprodscus", "blob.core.windows.net", "openai.com"];

// ── Object Storage client (singleton) ─────────────────────────────────────────
let _storageClient: ReplitStorageClient | null = null;
function getStorageClient(): ReplitStorageClient {
  if (!_storageClient) _storageClient = new ReplitStorageClient();
  return _storageClient;
}

/** Discover the active bucket ID (used to construct /public-objects/ URLs).
 *  Uses the Object Storage sidecar's supported discovery endpoint.
 *  The SDK Client does not expose a public bucketId accessor. */
async function getBucketId(): Promise<string> {
  const r = await fetch("http://127.0.0.1:1106/object-storage/default-bucket").catch(() => null);
  const j = r?.ok ? await r.json().catch(() => null) : null;
  return (
    j?.bucketId ??
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ??
    "replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b"
  );
}

/** Upload a buffer to Object Storage, return the public /public-objects/ URL. */
async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  objectName: string,
): Promise<string> {
  const client = getStorageClient();
  // Note: UploadOptions only exposes { compress?: boolean } in this SDK version.
  // contentType is not a supported option; omit it.
  const result = await client.uploadFromBytes(objectName, buffer);
  if (!result.ok) {
    throw new Error(`Object Storage upload failed for ${objectName}: ${result.error?.message ?? "unknown"}`);
  }
  const bucketId = await getBucketId();
  return `/public-objects/${bucketId}/${objectName}`;
}

/** Download an image from a URL or decode a base64 data URI. */
async function fetchImageBytes(source: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (source.startsWith("data:")) {
    const commaIdx = source.indexOf(",");
    const meta = source.substring(5, commaIdx);
    const contentType = meta.split(";")[0] || "image/png";
    const b64 = source.substring(commaIdx + 1);
    return { buffer: Buffer.from(b64, "base64"), contentType };
  }
  const resp = await fetch(source, { signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) throw new Error(`Image download failed: HTTP ${resp.status} for ${source.slice(0, 80)}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get("content-type") || "image/png";
  return { buffer, contentType };
}

/** Build an object-storage key for a meal image variant. */
function buildObjectKey(mealName: string, variant: "thumb" | "display" | "orig", hash: string, ext: string): string {
  const slug = mealName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
  return `meal-images/${slug}-${variant}-${hash}.${ext}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface MediaAsset {
  id: string;
  status: "pending" | "ready" | "failed";
  thumbnailUrl: string | null;
  displayUrl: string | null;
  originalObjectKey: string | null;
}

/**
 * Process an image source (base64, temp URL, or permanent URL) into the
 * canonical media lifecycle.  Returns a MediaAsset record — callers must
 * store the returned `id` as `media_asset_id` in the entity table.
 *
 * HARD RULE: this function NEVER returns base64 as `thumbnailUrl` or
 * `displayUrl`.  On any failure the URLs are null and status is "failed".
 */
export async function processImageForMeal(
  source: string | null | undefined,
  mealName: string,
): Promise<MediaAsset> {
  // ── Case 1: No source ───────────────────────────────────────────────────────
  if (!source) {
    const [record] = await db.insert(mediaAssets).values({
      status: "pending",
      sourceType: "none",
    }).returning();
    logMedia("media_processed", { status: "pending", reason: "no_source", mealName });
    return { id: record.id, status: "pending", thumbnailUrl: null, displayUrl: null, originalObjectKey: null };
  }

  // ── Case 2: Already a first-party permanent URL ─────────────────────────────
  // Wrap in a media_assets record as-is (status: ready).
  // These don't get re-uploaded; no resizing at this stage.
  if (FIRST_PARTY_PREFIXES.some(p => source.startsWith(p))) {
    const [record] = await db.insert(mediaAssets).values({
      status: "ready",
      thumbnailUrl: source,
      displayUrl: source,
      sourceType: source.startsWith("/public-objects/") ? "object-storage" : "s3",
    }).returning();
    logMedia("media_processed", { status: "ready", reason: "already_permanent", mealName, url: source.slice(0, 60) });
    return { id: record.id, status: "ready", thumbnailUrl: source, displayUrl: source, originalObjectKey: null };
  }

  // ── Case 3: base64, temporary CDN URL, or other external URL ───────────────
  const isBase64 = source.startsWith("data:");
  const isTempUrl = TEMP_URL_PATTERNS.some(p => source.includes(p));
  const isExternal = source.startsWith("http://") || source.startsWith("https://");

  if (isBase64 || isTempUrl || isExternal) {
    const hash = crypto.createHash("sha256").update(source.slice(0, 300)).digest("hex").slice(0, 16);
    try {
      const { buffer: original, contentType } = await fetchImageBytes(source);
      const ext = contentType.includes("png") ? "png" : "jpg";

      // Thumbnail variant
      const thumbBuffer = await sharp(original)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      const thumbKey = buildObjectKey(mealName, "thumb", hash, "jpg");
      const thumbUrl = await uploadBuffer(thumbBuffer, "image/jpeg", thumbKey);

      // Display variant
      const displayBuffer = await sharp(original)
        .resize({ width: DISPLAY_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      const displayKey = buildObjectKey(mealName, "display", hash, "jpg");
      const displayUrl = await uploadBuffer(displayBuffer, "image/jpeg", displayKey);

      // Original (stored but not routinely delivered)
      const origKey = buildObjectKey(mealName, "orig", hash, ext);
      await uploadBuffer(original, contentType, origKey);

      const [record] = await db.insert(mediaAssets).values({
        status: "ready",
        thumbnailObjectKey: thumbKey,
        thumbnailUrl: thumbUrl,
        displayObjectKey: displayKey,
        displayUrl,
        originalObjectKey: origKey,
        sourceType: isBase64 ? "base64" : "url",
        mimeType: contentType,
      }).returning();

      logMedia("media_processed", {
        status: "ready",
        mealName,
        sourceType: isBase64 ? "base64" : "url",
        thumbBytes: thumbBuffer.length,
        displayBytes: displayBuffer.length,
        origBytes: original.length,
      });

      return { id: record.id, status: "ready", thumbnailUrl: thumbUrl, displayUrl, originalObjectKey: origKey };

    } catch (err: any) {
      const processingError = (err.message ?? "unknown").slice(0, 500);
      logMedia("media_failed", { mealName, sourceType: isBase64 ? "base64" : "url", error: processingError });

      const [record] = await db.insert(mediaAssets).values({
        status: "failed",
        sourceType: isBase64 ? "base64" : "url",
        processingError,
        retryCount: 0,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // retry eligibility in 5 min
      }).returning();

      // CRITICAL: base64 bytes are NOT returned. Caller stores null imageUrl.
      return { id: record.id, status: "failed", thumbnailUrl: null, displayUrl: null, originalObjectKey: null };
    }
  }

  // ── Case 4: Unknown relative path — treat as legacy first-party ─────────────
  const [record] = await db.insert(mediaAssets).values({
    status: "ready",
    thumbnailUrl: source,
    displayUrl: source,
    sourceType: "legacy",
  }).returning();
  logMedia("media_processed", { status: "ready", reason: "legacy_path", mealName });
  return { id: record.id, status: "ready", thumbnailUrl: source, displayUrl: source, originalObjectKey: null };
}

/**
 * Check whether a URL would violate the lifecycle boundary.
 * Returns true if the URL should never be written to a DB column directly.
 */
export function isUnsafeImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("data:")) return true;
  if (TEMP_URL_PATTERNS.some(p => url.includes(p))) return true;
  return false;
}

// ── Structured observability ─────────────────────────────────────────────────

function logMedia(event: string, data: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), service: "media-asset", event, ...data };
  if (data.status === "failed" || event === "media_failed") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/** Emit a lifecycle violation warning (base64 or temp URL reaching a persistence boundary). */
export function warnLifecycleViolation(
  context: string,
  url: string,
  action: "blocked" | "detected",
): void {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "media-asset",
      event: "lifecycle_violation",
      action,
      context,
      urlPrefix: url.slice(0, 40),
      urlLength: url.length,
    }),
  );
}
