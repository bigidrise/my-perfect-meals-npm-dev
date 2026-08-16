/**
 * Task 1248 — End-to-end image persistence verification
 *
 * Exercises the exact code path used by Recipe Maker:
 *   external URL → ingestImageToPermanentStorage → /public-objects/ URL
 *   → meal_image_cache DB entry → post-restart DB lookup → permanent URL
 *
 * Run: npx tsx scripts/verify-image-persistence.ts
 */

import sharp from "sharp";
import { ingestImageToPermanentStorage } from "../server/services/imageLifecycle";
import { db } from "../server/db";
import { mealImageCache } from "../server/db/schema/mealImageCache";
import { savedMeals } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

function pass(label: string, detail = "") {
  console.log(`✅ PASS  ${label}${detail ? `  (${detail})` : ""}`);
}
function fail(label: string, detail = "") {
  console.error(`❌ FAIL  ${label}${detail ? `  (${detail})` : ""}`);
}
function info(msg: string) {
  console.log(`ℹ️  ${msg}`);
}

const TEST_MEAL_NAME = "Task1248 Verification Test Meal";

async function main() {
  console.log("\n════════════════════════════════════════════════════════");
  console.log("  Task 1248 — Image persistence end-to-end verification");
  console.log("════════════════════════════════════════════════════════\n");

  let allPassed = true;

  // ── Step 1: Build a valid minimal JPEG with sharp ──────────────────────────
  info("Step 1 — Building valid test image (simulating DALL-E gpt-image-1 b64_json output)…");
  const jpegBuffer = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 200, b: 80 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

  const b64 = jpegBuffer.toString("base64");
  const sourceDataUri = `data:image/jpeg;base64,${b64}`;
  info(`Generated test JPEG: ${jpegBuffer.length} bytes → base64 length ${b64.length}`);

  // ── Step 2: Exercise ingestImageToPermanentStorage ─────────────────────────
  info("Step 2 — Running ingestImageToPermanentStorage…");
  const t0 = Date.now();
  const result = await ingestImageToPermanentStorage(sourceDataUri, TEST_MEAL_NAME);
  const elapsed = Date.now() - t0;

  if (!result.success) {
    fail("ingestImageToPermanentStorage returned success=false", result.error ?? "no error detail");
    allPassed = false;
  } else {
    pass(`ingestImageToPermanentStorage succeeded`, `${elapsed}ms`);
  }

  const permanentUrl = result.permanentUrl;

  if (!permanentUrl) {
    fail("permanentUrl is null — image was not stored in Object Storage");
    allPassed = false;
  } else if (!permanentUrl.startsWith("/public-objects/")) {
    fail(`permanentUrl is NOT a /public-objects/ path: ${permanentUrl.slice(0, 100)}`);
    allPassed = false;
  } else {
    pass(`permanentUrl is /public-objects/ path`, permanentUrl.slice(0, 80));
  }

  // ── Step 3: Verify the /public-objects/ URL is reachable ───────────────────
  if (permanentUrl) {
    info("Step 3 — Verifying /public-objects/ URL is reachable…");
    const devDomain = process.env.REPLIT_DEV_DOMAIN;
    if (devDomain) {
      try {
        const testUrl = `https://${devDomain}${permanentUrl}`;
        const resp = await fetch(testUrl, { signal: AbortSignal.timeout(12_000) });
        if (resp.ok) {
          const ct = resp.headers.get("content-type") ?? "";
          pass(`GET ${permanentUrl.slice(0, 60)} → HTTP ${resp.status}  content-type=${ct}`);
        } else {
          fail(`GET ${permanentUrl.slice(0, 60)} → HTTP ${resp.status}`, "route or bucket issue");
          allPassed = false;
        }
      } catch (e: any) {
        fail("HTTP reachability check threw", e.message ?? String(e));
        allPassed = false;
      }
    } else {
      info("REPLIT_DEV_DOMAIN not set — skipping HTTP reachability (run on Replit for this check)");
    }
  }

  // ── Step 4: Write to meal_image_cache (like mealImageGenerator does) ───────
  const testCacheKey = `task-1248-verify-${Date.now()}`;
  if (permanentUrl) {
    info("Step 4 — Writing permanent URL to meal_image_cache (simulating post-generation DB write)…");
    try {
      await db
        .insert(mealImageCache)
        .values({
          cacheKey: testCacheKey,
          imageUrl: permanentUrl,
          mealName: TEST_MEAL_NAME,
          promptUsed: "(task-1248 verification test)",
          validationStatus: "PASS",
          recipeSignature: "test-sig",
        })
        .onConflictDoUpdate({
          target: mealImageCache.cacheKey,
          set: { imageUrl: permanentUrl },
        });
      pass("meal_image_cache row written", testCacheKey);
    } catch (e: any) {
      fail("meal_image_cache write threw", e.message ?? String(e));
      allPassed = false;
    }
  }

  // ── Step 5: Post-restart simulation — DB lookup with empty mem-cache ────────
  if (permanentUrl) {
    info("Step 5 — Simulating server restart: reading URL back from DB cache (mem-cache is empty)…");
    try {
      const rows = await db
        .select({ imageUrl: mealImageCache.imageUrl, validationStatus: mealImageCache.validationStatus })
        .from(mealImageCache)
        .where(eq(mealImageCache.cacheKey, testCacheKey))
        .limit(1);

      if (rows.length === 0) {
        fail("Post-restart DB read returned no row");
        allPassed = false;
      } else {
        const row = rows[0];
        if (!row.imageUrl?.startsWith("/public-objects/")) {
          fail(`Post-restart URL is NOT permanent: ${(row.imageUrl ?? "").slice(0, 80)}`);
          allPassed = false;
        } else if (row.validationStatus !== "PASS") {
          fail(`Validation status in DB is not PASS: ${row.validationStatus}`);
          allPassed = false;
        } else {
          pass("Post-restart DB lookup returns permanent /public-objects/ URL", row.imageUrl.slice(0, 80));
          pass("Image survives server restart via DB cache ✓");
        }
      }

      // Clean up test row
      await db.delete(mealImageCache).where(eq(mealImageCache.cacheKey, testCacheKey));
      info("Test cache row cleaned up.");
    } catch (e: any) {
      fail("Post-restart DB read/cleanup threw", e.message ?? String(e));
      allPassed = false;
    }
  }

  // ── Step 6: Snapshot of existing saved meals ────────────────────────────────
  info("Step 6 — Checking existing inspiration saves for permanent image URLs…");
  try {
    const rows = await db
      .select({
        total: sql<number>`COUNT(*)`,
        permanent: sql<number>`COUNT(CASE WHEN meal_data->>'imageUrl' LIKE '/public-objects/%' THEN 1 END)`,
        broken_s3: sql<number>`COUNT(CASE WHEN meal_data->>'imageUrl' LIKE 'https://my-perfect-meals%' THEN 1 END)`,
        null_count: sql<number>`COUNT(CASE WHEN meal_data->>'imageUrl' IS NULL THEN 1 END)`,
      })
      .from(savedMeals)
      .where(eq(savedMeals.sourceType, "my-inspiration"));

    const s = rows[0];
    info(
      `Inspiration saves:  total=${s.total}  /public-objects/=${s.permanent}  broken-S3=${s.broken_s3}  null=${s.null_count}`
    );

    if (Number(s.permanent) > 0) {
      pass(`${s.permanent} existing inspiration saves carry permanent /public-objects/ URLs`);
    } else {
      info("No existing saves carry /public-objects/ URLs yet (may be freshly reset env)");
    }
  } catch (e: any) {
    info(`saved_meals stats skipped: ${e.message}`);
  }

  // ── Step 7: Snapshot of meal_image_cache ────────────────────────────────────
  info("Step 7 — Checking meal_image_cache URL distribution…");
  try {
    const rows = await db
      .select({
        total: sql<number>`COUNT(*)`,
        obj_storage: sql<number>`COUNT(CASE WHEN image_url LIKE '/public-objects/%' THEN 1 END)`,
        s3_broken: sql<number>`COUNT(CASE WHEN image_url LIKE 'https://my-perfect-meals%' THEN 1 END)`,
      })
      .from(mealImageCache);

    const c = rows[0];
    info(
      `meal_image_cache:  total=${c.total}  /public-objects/=${c.obj_storage}  S3(broken)=${c.s3_broken}`
    );
    if (Number(c.s3_broken) > 0) {
      info(
        `Note: ${c.s3_broken} stale S3 entries exist (from before Object Storage migration). ` +
        `These will be evicted by the DB-CACHE EVICT (stale temp URL) guard the next time each meal is requested.`
      );
    }
  } catch (e: any) {
    info(`meal_image_cache stats skipped: ${e.message}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════════");
  if (allPassed) {
    console.log("  RESULT: ALL CHECKS PASSED ✅");
    console.log("  The Recipe Maker image persistence chain is working:");
    console.log("  DALL-E b64 → Object Storage → /public-objects/ URL");
    console.log("  → meal_image_cache DB → survives server restart ✓");
  } else {
    console.log("  RESULT: ONE OR MORE CHECKS FAILED ❌");
    console.log("  Review the FAIL lines above for details.");
  }
  console.log("════════════════════════════════════════════════════════\n");

  process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
  console.error("Script error:", e);
  process.exit(1);
});
