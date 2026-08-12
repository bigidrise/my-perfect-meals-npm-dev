/**
 * Step 3B Migration — saved_meals base64 → Replit Object Storage
 *
 * Safety rules enforced:
 *  1. Inventory before any changes, report exact count
 *  2. Upload first, verify, then update DB (never the reverse)
 *  3. If upload or verify fails → leave DB row unchanged, log failure
 *  4. Idempotent: skip rows that already have a permanent URL
 *  5. Never delete any saved meal
 *  6. Never touch DALL-E CDN rows (can't recover expired URLs)
 *  7. Step 2 response-stripping remains untouched
 */

import { db } from "../server/db.ts";
import { sql } from "drizzle-orm";
import { uploadImageToPermanentStorage } from "../server/services/permanentImageStorage.ts";
import { Client as ReplitStorageClient } from "@replit/object-storage";
import crypto from "crypto";

const storageClient = new ReplitStorageClient();

// ── HELPERS ─────────────────────────────────────────────────────────────────

function isPermanentUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith("/public-objects/") ||
    url.includes(".s3.") && url.includes("amazonaws.com")
  );
}

function isBase64Url(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("data:");
}

// Stable hash so rerunning produces the same object name for the same row.
function stableHash(id: string, base64Snippet: string): string {
  return crypto
    .createHash("sha256")
    .update(id + base64Snippet.slice(0, 200))
    .digest("hex")
    .slice(0, 16);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Step 3B: saved_meals base64 → Replit Object Storage");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── PRE-FLIGHT INVENTORY ─────────────────────────────────────────────────
  const inv = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' LIKE 'data:%')                         AS base64_count,
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' LIKE '%oaidalleapiprodscus%')           AS dalle_cdn_count,
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' LIKE '/public-objects/%')               AS replit_obj_count,
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' LIKE 'https://%.s3.%.amazonaws.com/%') AS s3_count,
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' IS NULL OR meal_data->>'imageUrl'='')   AS null_count,
      COUNT(*)                                                                               AS total_count
    FROM saved_meals
  `);
  const before = inv.rows[0] as Record<string, string>;
  console.log("PRE-MIGRATION INVENTORY:");
  console.log(`  Total records   : ${before.total_count}`);
  console.log(`  base64 images   : ${before.base64_count}  ← TO MIGRATE`);
  console.log(`  S3 URLs         : ${before.s3_count}       (permanent, skip)`);
  console.log(`  Object Storage  : ${before.replit_obj_count}        (permanent, skip)`);
  console.log(`  DALL-E CDN      : ${before.dalle_cdn_count}      (expired, skip — report only)`);
  console.log(`  null/empty      : ${before.null_count}`);
  console.log("");

  // ── FETCH BASE64 ROWS ────────────────────────────────────────────────────
  const base64Rows = await db.execute(sql`
    SELECT id, user_id, meal_data
    FROM saved_meals
    WHERE meal_data->>'imageUrl' LIKE 'data:%'
    ORDER BY created_at ASC
  `);

  const rows = base64Rows.rows as Array<{
    id: string;
    user_id: string;
    meal_data: Record<string, any>;
  }>;

  console.log(`Fetched ${rows.length} base64 rows. Starting migration…\n`);

  const results = {
    migrated: 0,
    skipped_already_permanent: 0,
    failed: [] as Array<{ id: string; name: string; error: string }>,
  };

  // ── PROCESS EACH ROW ─────────────────────────────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mealName: string = row.meal_data?.name ?? `meal-${row.id.slice(0, 8)}`;
    const imageUrl: string = row.meal_data?.imageUrl ?? "";
    const prefix = `[${i + 1}/${rows.length}] "${mealName.slice(0, 40)}"`;

    // Idempotency guard — skip if already migrated in a previous run
    if (isPermanentUrl(imageUrl)) {
      console.log(`${prefix} → SKIP (already permanent)`);
      results.skipped_already_permanent++;
      continue;
    }

    if (!isBase64Url(imageUrl)) {
      // Shouldn't happen given our WHERE clause, but be safe
      console.log(`${prefix} → SKIP (not base64, url type unknown)`);
      continue;
    }

    try {
      // 1. Upload to Object Storage via the proven server function
      const hash = stableHash(row.id, imageUrl);
      const uploadResult = await uploadImageToPermanentStorage({
        imageUrl,
        mealName,
        imageHash: hash,
      });

      // 2. Verify the object actually exists in storage
      const existsResult = await storageClient.exists(uploadResult.objectPath);
      if (!existsResult.ok || !existsResult.value) {
        throw new Error(
          `Upload reported success but exists() returned ${JSON.stringify(existsResult)}`
        );
      }

      // 3. Only after verification, update the DB row
      const updatedMealData = {
        ...row.meal_data,
        imageUrl: uploadResult.permanentUrl,
      };

      await db.execute(sql`
        UPDATE saved_meals
        SET meal_data = ${JSON.stringify(updatedMealData)}::jsonb
        WHERE id = ${row.id}
      `);

      console.log(`${prefix} → ✅ ${uploadResult.permanentUrl.slice(-60)}`);
      results.migrated++;
    } catch (err: any) {
      const errMsg = String(err?.message ?? err).slice(0, 200);
      console.error(`${prefix} → ❌ FAILED: ${errMsg}`);
      results.failed.push({ id: row.id, name: mealName, error: errMsg });
      // Row is left completely unchanged — do not re-throw
    }
  }

  // ── POST-MIGRATION INVENTORY ──────────────────────────────────────────────
  const inv2 = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' LIKE 'data:%')                         AS base64_count,
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' LIKE '%oaidalleapiprodscus%')           AS dalle_cdn_count,
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' LIKE '/public-objects/%')               AS replit_obj_count,
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' LIKE 'https://%.s3.%.amazonaws.com/%') AS s3_count,
      COUNT(*) FILTER (WHERE meal_data->>'imageUrl' IS NULL OR meal_data->>'imageUrl'='')   AS null_count,
      COUNT(*)                                                                               AS total_count
    FROM saved_meals
  `);
  const after = inv2.rows[0] as Record<string, string>;

  // Response size after migration
  const sizeRow = await db.execute(sql`
    SELECT ROUND(SUM(octet_length(meal_data::text)) / 1048576.0, 2) AS total_mb
    FROM saved_meals
  `);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  MIGRATION REPORT");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Total records   : ${before.total_count} → ${after.total_count} (unchanged)`);
  console.log(`  base64 images   : ${before.base64_count} → ${after.base64_count}`);
  console.log(`  Object Storage  : ${before.replit_obj_count} → ${after.replit_obj_count}`);
  console.log(`  S3 URLs         : ${before.s3_count} → ${after.s3_count}`);
  console.log(`  DALL-E CDN      : ${before.dalle_cdn_count} → ${after.dalle_cdn_count} (untouched — expired, unrecoverable)`);
  console.log(`  null/empty      : ${before.null_count} → ${after.null_count}`);
  console.log("");
  console.log("  Migrated        : ✅ " + results.migrated);
  console.log("  Already perm    : " + results.skipped_already_permanent);
  console.log("  Failed          : " + results.failed.length);
  if (results.failed.length > 0) {
    console.log("\n  FAILURES:");
    results.failed.forEach(f => console.log(`    - ${f.id} "${f.name}": ${f.error}`));
  }
  console.log(`\n  DB payload size : ${(sizeRow.rows[0] as any).total_mb} MB (all saved_meals)`);

  // ── SPOT-CHECK: verify 3 migrated URLs are retrievable ──────────────────
  const spotRows = await db.execute(sql`
    SELECT id, meal_data->>'imageUrl' AS url, meal_data->>'name' AS name
    FROM saved_meals
    WHERE meal_data->>'imageUrl' LIKE '/public-objects/%'
    LIMIT 3
  `);

  if (spotRows.rows.length > 0) {
    console.log("\n  SPOT-CHECK (3 migrated URLs, existence verified):");
    for (const r of spotRows.rows as any[]) {
      // objectPath = strip /public-objects/<bucketId>/
      const parts = r.url.split("/");
      const objectPath = parts.slice(3).join("/"); // strip /public-objects/<bucket>/
      const ex = await storageClient.exists(objectPath);
      const status = ex.ok && ex.value ? "✅" : "❌";
      console.log(`    ${status} "${r.name?.slice(0, 40)}" → ${r.url.slice(-55)}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  if (results.failed.length === 0 && Number(after.base64_count) === 0) {
    console.log("  ✅ ALL BASE64 IMAGES MIGRATED SUCCESSFULLY");
  } else if (results.failed.length > 0) {
    console.log(`  ⚠️  ${results.failed.length} RECORDS UNCHANGED (failures above)`);
  }
  console.log("  DALL-E CDN records left as-is (Step 2 stripping handles them at read time)");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch(e => {
  console.error("Migration script crashed:", e);
  process.exit(1);
});
