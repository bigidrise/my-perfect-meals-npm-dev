/**
 * One-time migration: clear stale S3 image cache entries
 *
 * The meal_image_cache table contains rows whose image_url points to the old
 * S3 bucket (https://my-perfect-meals*) which now returns HTTP 403.
 * These rows cause the mealImageGenerator DB-CACHE path to treat the entry
 * as "permanent / valid" and return the broken URL to the client instead of
 * regenerating. Deleting them forces fresh DALL-E generation the next time
 * each meal is requested, which is far better than serving broken image URLs.
 *
 * Safety rules:
 *  1. Inventory before any changes, report exact count.
 *  2. Only delete rows whose image_url matches the stale S3 prefix.
 *  3. Never touch rows that already point to /public-objects/ or other valid URLs.
 *  4. Idempotent: running twice is safe (nothing left to delete on second run).
 */

import { db } from "../server/db.ts";
import { sql } from "drizzle-orm";

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Clear stale S3 entries from meal_image_cache");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── PRE-FLIGHT INVENTORY ──────────────────────────────────────────────────
  const invBefore = await db.execute(sql`
    SELECT
      COUNT(*)                                                             AS total_count,
      COUNT(*) FILTER (WHERE image_url LIKE 'https://my-perfect-meals%')  AS stale_s3_count,
      COUNT(*) FILTER (WHERE image_url LIKE '/public-objects/%')           AS obj_storage_count,
      COUNT(*) FILTER (WHERE image_url LIKE 'https://%amazonaws.com%'
                        AND  image_url NOT LIKE 'https://my-perfect-meals%') AS other_s3_count,
      COUNT(*) FILTER (WHERE image_url NOT LIKE 'https://%'
                        AND  image_url NOT LIKE '/public-objects/%')       AS other_count
    FROM meal_image_cache
  `);

  const before = invBefore.rows[0] as Record<string, string>;
  console.log("PRE-DELETION INVENTORY:");
  console.log(`  Total records      : ${before.total_count}`);
  console.log(`  Stale S3 URLs      : ${before.stale_s3_count}  ← TO DELETE`);
  console.log(`  Object Storage     : ${before.obj_storage_count}  (valid, keep)`);
  console.log(`  Other S3 URLs      : ${before.other_s3_count}   (keep — different bucket)`);
  console.log(`  Other              : ${before.other_count}`);
  console.log("");

  const staleCount = Number(before.stale_s3_count);
  if (staleCount === 0) {
    console.log("✅ No stale S3 entries found. Nothing to do.\n");
    return;
  }

  // ── SAMPLE A FEW ROWS BEFORE DELETION ────────────────────────────────────
  const sample = await db.execute(sql`
    SELECT cache_key, meal_name, image_url, created_at
    FROM meal_image_cache
    WHERE image_url LIKE 'https://my-perfect-meals%'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log(`Sample of rows to be deleted (up to 5):`);
  for (const r of sample.rows as any[]) {
    console.log(`  - "${r.meal_name}" | created: ${r.created_at} | url: ${r.image_url.slice(0, 70)}`);
  }
  console.log("");

  // ── DELETE STALE ROWS ─────────────────────────────────────────────────────
  console.log(`Deleting ${staleCount} stale S3 cache entries…`);
  const result = await db.execute(sql`
    DELETE FROM meal_image_cache
    WHERE image_url LIKE 'https://my-perfect-meals%'
  `);

  const deletedCount = (result as any).rowCount ?? staleCount;
  console.log(`Deleted: ${deletedCount} rows\n`);

  // ── POST-DELETION INVENTORY ───────────────────────────────────────────────
  const invAfter = await db.execute(sql`
    SELECT
      COUNT(*)                                                             AS total_count,
      COUNT(*) FILTER (WHERE image_url LIKE 'https://my-perfect-meals%')  AS stale_s3_count,
      COUNT(*) FILTER (WHERE image_url LIKE '/public-objects/%')           AS obj_storage_count
    FROM meal_image_cache
  `);

  const after = invAfter.rows[0] as Record<string, string>;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  DELETION REPORT");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Total records    : ${before.total_count} → ${after.total_count}`);
  console.log(`  Stale S3 entries : ${before.stale_s3_count} → ${after.stale_s3_count}`);
  console.log(`  Object Storage   : ${before.obj_storage_count} → ${after.obj_storage_count} (unchanged)`);
  console.log("");

  if (Number(after.stale_s3_count) === 0) {
    console.log("  ✅ ALL STALE S3 CACHE ENTRIES DELETED SUCCESSFULLY");
    console.log("     Next request for each affected meal will trigger fresh DALL-E generation.");
  } else {
    console.log(`  ⚠️  ${after.stale_s3_count} stale S3 entries remain — re-run to retry.`);
    process.exit(1);
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch(e => {
  console.error("Script crashed:", e);
  process.exit(1);
});
