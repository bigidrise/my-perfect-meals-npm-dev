#!/usr/bin/env tsx
/**
 * Provision the migration-manifest.json storage canary object in the production bucket.
 *
 * This object is the canary used by:
 *   - scripts/run-prod-acceptance.sh  — Gate 5 (HTTP canary via /public-objects/)
 *   - scripts/pre-publish-validate.sh — Section 5 (storage reachability)
 *
 * Run this once when setting up a new production bucket, and again whenever the
 * bucket is rotated. The upload is idempotent — safe to re-run at any time.
 *
 * Usage:
 *   bash scripts/provision-storage-canary.sh
 *   — or —
 *   DEFAULT_OBJECT_STORAGE_BUCKET_ID=<prod-bucket-id> npx tsx scripts/provision-storage-canary.ts
 */

import { Client } from "@replit/object-storage";

const DEV_BUCKET = "replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b";
const EXPECTED_PROD_BUCKET = "replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491";

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

if (!bucketId) {
  console.error("❌ DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set.");
  console.error("   Run this script in the production workspace where the secret is configured.");
  process.exit(1);
}

if (bucketId === DEV_BUCKET) {
  console.error("❌ DEFAULT_OBJECT_STORAGE_BUCKET_ID is the DEV bucket.");
  console.error("   This script must only be run in the production workspace.");
  process.exit(1);
}

if (bucketId !== EXPECTED_PROD_BUCKET) {
  console.warn(`⚠️  Bucket ${bucketId} is not the known production bucket.`);
  console.warn(`   Known prod bucket: ${EXPECTED_PROD_BUCKET}`);
  console.warn("   Continuing — if this is a rotated bucket, update EXPECTED_PROD_BUCKET in this script.");
}

console.log(`\nProvisioning storage canary in bucket: ${bucketId}`);

const client = new Client({ bucketId });

const manifest = JSON.stringify(
  {
    purpose: "storage-health-canary",
    note: "Do not delete — used by /api/health/full endpoint and post-publish acceptance tests (scripts/run-prod-acceptance.sh Gate 5 and scripts/pre-publish-validate.sh Section 5)",
    provisioned: new Date().toISOString(),
  },
  null,
  2,
);

const result = await client.uploadFromText("migration-manifest.json", manifest);

if (result.ok) {
  console.log("✅ migration-manifest.json provisioned successfully.");
  console.log(
    `   Verify: curl https://app.myperfectmeals.com/public-objects/${bucketId}/migration-manifest.json`,
  );
  console.log("\nCanary is ready. Gate 5 and storage reachability checks will now pass.");
} else {
  console.error("❌ Upload failed:", result.error);
  process.exit(1);
}
