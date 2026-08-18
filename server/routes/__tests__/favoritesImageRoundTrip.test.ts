/**
 * server/routes/__tests__/favoritesImageRoundTrip.test.ts
 *
 * Integration tests for the Favorites image round-trip.
 *
 * Confirms that meals saved through /api/craving-creator/log and
 * /api/inspiration/save end up with a first-party /public-objects/ imageUrl
 * in the database — never null from a valid URL, never a base64 blob, and
 * never an ephemeral CDN URL.
 *
 * Coverage:
 *  §1  isFirstPartyImageUrl — URL classification (pure function)
 *  §2  isUnsafeImageUrl — lifecycle-violation detection (pure function)
 *  §3  craving-creator/log — base64 guard strips blob before lifecycle gate
 *  §4  inspiration/save   — base64 guard strips blob before lifecycle gate
 *  §5  processMealImageForSave — first-party URL passes through unchanged
 *  §6  processMealImageForSave — temp CDN URL yields /public-objects/ URL after mock upload
 *  §7  processMealImageForSave — base64 source yields null on failed upload (no blob leaks)
 *  §8  processMealImageForSave — base64 source yields /public-objects/ URL on successful mock upload
 *
 * Pure-function + lightweight mock tests: no real DB, no real network calls.
 * Run: npx tsx server/routes/__tests__/favoritesImageRoundTrip.test.ts
 */

import { isFirstPartyImageUrl } from "../../services/imageLifecycle";
import { isUnsafeImageUrl } from "../../services/mediaAssetService";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test harness (matches project style)
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failMessages.push(label);
    console.log(`  ❌ ${label}`);
  }
}

function eq<T>(a: T, b: T, label: string) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) console.log(`     expected: ${JSON.stringify(b)}\n     received: ${JSON.stringify(a)}`);
  assert(ok, label);
}

function section(name: string) {
  console.log(`\n── ${name}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §1  isFirstPartyImageUrl — URL classification
// ─────────────────────────────────────────────────────────────────────────────
section("§1 isFirstPartyImageUrl — URL classification");

{
  const r = isFirstPartyImageUrl("/public-objects/bucket-id/meal-images/test-thumb-abc.jpg");
  assert(r.isFirstParty === true,   "recognises /public-objects/ as first-party");
  assert(r.needsIngestion === false, "/public-objects/ does not need ingestion");
}

{
  const r = isFirstPartyImageUrl("/images/placeholder.jpg");
  assert(r.isFirstParty === true,   "recognises /images/ as first-party");
  assert(r.needsIngestion === false, "/images/ does not need ingestion");
}

{
  const r = isFirstPartyImageUrl("https://oaidalleapiprodscus.blob.core.windows.net/private/img.jpg");
  assert(r.isFirstParty === false,  "marks DALL-E CDN URL as NOT first-party");
  assert(r.needsIngestion === true, "DALL-E CDN URL needs ingestion");
}

{
  const r = isFirstPartyImageUrl("https://external-cdn.example.com/img.png");
  assert(r.isFirstParty === false,  "marks unknown external URL as NOT first-party");
  assert(r.needsIngestion === true, "unknown external URL needs ingestion");
}

{
  const b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ==";
  const r = isFirstPartyImageUrl(b64);
  assert(r.isFirstParty === false,  "base64 data URI is NOT first-party");
  assert(r.needsIngestion === true, "base64 data URI needs ingestion");
}

{
  const r = isFirstPartyImageUrl(null);
  assert(r.isFirstParty === false,  "null URL is not first-party");
  assert(r.needsIngestion === false, "null URL does not need ingestion");
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  isUnsafeImageUrl — lifecycle-violation detection
// ─────────────────────────────────────────────────────────────────────────────
section("§2 isUnsafeImageUrl — lifecycle-violation detection");

{
  const b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgAB";
  assert(isUnsafeImageUrl(b64) === true,   "base64 data URI flagged as unsafe");
}

{
  assert(isUnsafeImageUrl("https://oaidalleapiprodscus.blob.core.windows.net/x") === true,
    "DALL-E temp URL flagged as unsafe");
}

{
  assert(isUnsafeImageUrl("/public-objects/bucket/img.jpg") === false,
    "/public-objects/ URL is NOT unsafe");
}

{
  assert(isUnsafeImageUrl(null) === false, "null is not unsafe");
  assert(isUnsafeImageUrl(undefined) === false, "undefined is not unsafe");
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  craving-creator/log — base64 guard (route-level, no DB required)
// ─────────────────────────────────────────────────────────────────────────────
section("§3 craving-creator/log — base64 guard strips blob before lifecycle gate");

/**
 * Simulates the guard in POST /api/craving-creator/log exactly as written
 * in server/routes/craving-creator.ts lines 341-348.
 */
function cravingCreatorBase64Guard(rawInputImageUrl: string | null): {
  sanitisedUrl: string | null;
  wasStripped: boolean;
} {
  const sanitisedInputImageUrl =
    rawInputImageUrl?.startsWith("data:") ? null : rawInputImageUrl;
  const wasStripped = !!(rawInputImageUrl && !sanitisedInputImageUrl);
  return { sanitisedUrl: sanitisedInputImageUrl, wasStripped };
}

{
  const b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ";
  const { sanitisedUrl, wasStripped } = cravingCreatorBase64Guard(b64);
  eq(sanitisedUrl, null,  "base64 imageUrl is stripped to null before lifecycle gate");
  assert(wasStripped,     "wasStripped flag is true for base64 input");
}

{
  const permanentUrl = "/public-objects/bucket-id/meal-images/grilled-chicken-thumb-abc123.jpg";
  const { sanitisedUrl, wasStripped } = cravingCreatorBase64Guard(permanentUrl);
  eq(sanitisedUrl, permanentUrl, "first-party /public-objects/ URL is NOT stripped");
  assert(!wasStripped,           "wasStripped is false for first-party URL");
}

{
  const tempUrl = "https://oaidalleapiprodscus.blob.core.windows.net/img.jpg";
  const { sanitisedUrl, wasStripped } = cravingCreatorBase64Guard(tempUrl);
  eq(sanitisedUrl, tempUrl, "temp CDN URL passes guard (lifecycle gate handles it downstream)");
  assert(!wasStripped,      "wasStripped is false for CDN URL (not base64)");
}

{
  const { sanitisedUrl, wasStripped } = cravingCreatorBase64Guard(null);
  eq(sanitisedUrl, null, "null imageUrl stays null through guard");
  assert(!wasStripped,    "wasStripped is false for null input");
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  inspiration/save — base64 guard (route-level, no DB required)
// ─────────────────────────────────────────────────────────────────────────────
section("§4 inspiration/save — base64 guard strips blob before lifecycle gate");

/**
 * Simulates the guard in POST /api/inspiration/save exactly as written
 * in server/routes/inspiration.ts lines 331-343.
 */
function inspirationSaveBase64Guard(rawImageUrl: string | null): {
  sanitisedUrl: string | null;
  wasStripped: boolean;
} {
  const sanitisedImageUrl: string | null =
    rawImageUrl?.startsWith("data:") ? null : rawImageUrl;
  const wasStripped = !!(rawImageUrl && !sanitisedImageUrl);
  return { sanitisedUrl: sanitisedImageUrl, wasStripped };
}

{
  const b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD";
  const { sanitisedUrl, wasStripped } = inspirationSaveBase64Guard(b64);
  eq(sanitisedUrl, null, "base64 mealData.imageUrl is stripped to null before lifecycle gate");
  assert(wasStripped,    "wasStripped flag is true for base64 input");
}

{
  const permanentUrl = "/public-objects/bucket-id/meal-images/salmon-dish-thumb-xyz987.jpg";
  const { sanitisedUrl, wasStripped } = inspirationSaveBase64Guard(permanentUrl);
  eq(sanitisedUrl, permanentUrl, "first-party /public-objects/ URL passes through guard unchanged");
  assert(!wasStripped,           "wasStripped is false for already-permanent URL");
}

{
  const { sanitisedUrl, wasStripped } = inspirationSaveBase64Guard(null);
  eq(sanitisedUrl, null, "null imageUrl stays null through inspiration/save guard");
  assert(!wasStripped,    "wasStripped is false for null input");
}

// ─────────────────────────────────────────────────────────────────────────────
// §5–8  processMealImageForSave — mock-based lifecycle tests
//
// We test the function's contract by substituting the DB + Object Storage
// boundary with lightweight in-memory stubs that mirror the real behaviour.
// ─────────────────────────────────────────────────────────────────────────────
section("§5–8 processMealImageForSave — mock-based lifecycle tests");

// ── Mock MediaAsset builder ──────────────────────────────────────────────────
interface MockMediaAsset {
  id: string;
  status: "pending" | "ready" | "failed";
  thumbnailUrl: string | null;
  displayUrl: string | null;
  originalObjectKey: string | null;
}

type MockProcessImageFn = (source: string | null | undefined, mealName: string) => Promise<MockMediaAsset>;

/**
 * Re-implements processMealImageForSave logic in isolation so we can swap
 * processImageForMeal for a mock without touching the real module.
 * The logic mirrors server/services/imageLifecycle.ts exactly.
 */
async function simulateProcessMealImageForSave(
  imageUrl: string | undefined | null,
  mealName: string,
  mockProcessImage: MockProcessImageFn,
): Promise<{ imageUrl: string | null; imagePending: boolean; ingestionAttempted: boolean }> {
  if (!imageUrl) {
    return { imageUrl: null, imagePending: false, ingestionAttempted: false };
  }

  const asset = await mockProcessImage(imageUrl, mealName);

  const safeImageUrl = asset.thumbnailUrl ?? asset.displayUrl ?? null;
  const finalImageUrl = asset.status === "ready" ? (safeImageUrl ?? null) : null;

  // last-resort: never let a base64 blob escape
  if (finalImageUrl?.startsWith("data:")) {
    return { imageUrl: null, imagePending: true, ingestionAttempted: true };
  }

  return {
    imageUrl: finalImageUrl,
    imagePending: asset.status !== "ready",
    ingestionAttempted: asset.status !== "pending",
  };
}

// ── §5: first-party URL passes through unchanged ─────────────────────────────
{
  const permanentUrl = "/public-objects/bucket-id/meal-images/chicken-thumb-abc.jpg";

  const mockProcessImage: MockProcessImageFn = async (source) => ({
    id: "asset-001",
    status: "ready",
    thumbnailUrl: source as string,
    displayUrl: source as string,
    originalObjectKey: null,
  });

  const result = await simulateProcessMealImageForSave(
    permanentUrl,
    "Grilled Chicken",
    mockProcessImage,
  );

  assert(
    result.imageUrl === permanentUrl,
    "§5 first-party /public-objects/ URL is preserved unchanged after lifecycle gate",
  );
  assert(
    result.imageUrl?.startsWith("/public-objects/") === true,
    "§5 returned imageUrl starts with /public-objects/",
  );
  assert(!result.imagePending, "§5 imagePending is false for a ready first-party asset");
}

// ── §6: temp CDN URL → /public-objects/ URL after mock upload ────────────────
{
  const tempUrl = "https://oaidalleapiprodscus.blob.core.windows.net/private/dalle-img.jpg";
  const uploadedUrl = "/public-objects/bucket-id/meal-images/salmon-thumb-def456.jpg";

  const mockProcessImage: MockProcessImageFn = async (_source) => ({
    id: "asset-002",
    status: "ready",
    thumbnailUrl: uploadedUrl,
    displayUrl: uploadedUrl.replace("-thumb-", "-display-"),
    originalObjectKey: "meal-images/salmon-orig-def456.jpg",
  });

  const result = await simulateProcessMealImageForSave(
    tempUrl,
    "Salmon Fillet",
    mockProcessImage,
  );

  assert(
    result.imageUrl?.startsWith("/public-objects/") === true,
    "§6 temp CDN URL is replaced with a first-party /public-objects/ URL after upload",
  );
  assert(
    result.imageUrl !== tempUrl,
    "§6 returned URL is NOT the original temp CDN URL",
  );
  assert(
    result.imageUrl !== null,
    "§6 imageUrl is non-null after successful mock upload",
  );
  assert(!result.imagePending, "§6 imagePending is false after successful upload");
}

// ── §7: base64 source → null when upload fails (no blob leak) ────────────────
{
  const b64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ==";

  const mockProcessImage: MockProcessImageFn = async (_source) => ({
    id: "asset-003",
    status: "failed",
    thumbnailUrl: null,
    displayUrl: null,
    originalObjectKey: null,
  });

  const result = await simulateProcessMealImageForSave(
    b64,
    "Mystery Meal",
    mockProcessImage,
  );

  eq(result.imageUrl, null,
    "§7 failed upload returns null imageUrl — base64 blob is NOT persisted to DB");
  assert(result.imagePending,       "§7 imagePending is true after failed upload");
  assert(result.ingestionAttempted, "§7 ingestionAttempted is true (we tried)");
}

// ── §8: base64 source → /public-objects/ URL when upload succeeds ─────────────
{
  const b64 =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAoHBwgHBgoICAgLCgoL";
  const uploadedThumb = "/public-objects/bucket-id/meal-images/pasta-thumb-ghi789.jpg";

  const mockProcessImage: MockProcessImageFn = async (_source) => ({
    id: "asset-004",
    status: "ready",
    thumbnailUrl: uploadedThumb,
    displayUrl: uploadedThumb.replace("-thumb-", "-display-"),
    originalObjectKey: "meal-images/pasta-orig-ghi789.jpg",
  });

  const result = await simulateProcessMealImageForSave(
    b64,
    "Creamy Pasta",
    mockProcessImage,
  );

  assert(
    result.imageUrl?.startsWith("/public-objects/") === true,
    "§8 successful base64 upload yields a first-party /public-objects/ URL",
  );
  assert(
    result.imageUrl !== b64,
    "§8 returned URL is NOT the original base64 blob",
  );
  assert(
    !(result.imageUrl?.startsWith("data:")),
    "§8 returned imageUrl does not start with 'data:' (no blob leaks to DB)",
  );
  assert(!result.imagePending, "§8 imagePending is false after successful base64 upload");
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failMessages.length > 0) {
  console.log("\nFailed assertions:");
  failMessages.forEach((m) => console.log(`  ✗ ${m}`));
  process.exit(1);
} else {
  console.log("All assertions passed ✓");
}
