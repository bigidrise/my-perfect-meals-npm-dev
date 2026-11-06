// Bounded Development-only verification. Never imports the application database,
// rewrites saved references, or invokes an image generator.
import { Client } from "@replit/object-storage";
import { randomUUID, createHash } from "node:crypto";
import {
  resolveMealImageStorageContext, PRODUCTION_MEAL_IMAGE_BUCKET_ID,
} from "../server/services/mealImageBucket";

async function main() {
  const context = resolveMealImageStorageContext();
  if (context.environment !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("This probe is restricted to unpublished Development.");
  }
  const client = new Client({ bucketId: context.bucketId });
  const summarize = (result: any) => ({
    ok: result.ok === true,
    permissionDenied: !result.ok && /permission|access.*denied|403/i.test(result.error?.message ?? ""),
  });
  const listing = await client.list({ prefix: "meal-images/", maxResults: 3 });
  console.log(JSON.stringify({ stage: "active-prefix-list", ...summarize(listing), count: listing.ok ? listing.value.length : 0 }));
  if (listing.ok) for (const object of listing.value) {
    const bytes = await client.downloadAsBytes(object.name);
    console.log(JSON.stringify({ stage: "active-existing-image-read", ...summarize(bytes), bytes: bytes.ok ? bytes.value[0].length : 0 }));
  }
  const foreign = new Client({ bucketId: PRODUCTION_MEAL_IMAGE_BUCKET_ID });
  const foreignRead = await foreign.exists("meal-images/carnitas-tostadas-thumb-f859928a41dc25b6.jpg");
  console.log(JSON.stringify({ stage: "affected-reference-is-inactive-production-bucket", ...summarize(foreignRead) }));

  if (!process.argv.includes("--write-probe")) return;
  // A diagnostic object, never registered as a meal image or returned as a meal.
  const key = `diagnostics/development-image-storage/${randomUUID()}.txt`;
  const payload = Buffer.from(`Development storage round-trip ${randomUUID()}`);
  const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  let written = false;
  try {
    const upload = await client.uploadFromBytes(key, payload);
    written = upload.ok;
    console.log(JSON.stringify({ stage: "diagnostic-write", ...summarize(upload) }));
    if (!upload.ok) return;
    for (const stage of ["diagnostic-read", "diagnostic-new-client-read"]) {
      const reader = stage === "diagnostic-read" ? client : new Client({ bucketId: context.bucketId });
      const download = await reader.downloadAsBytes(key);
      console.log(JSON.stringify({
        stage, ...summarize(download),
        bytesMatch: download.ok && hash(download.value[0]) === hash(payload),
      }));
    }
  } finally {
    if (written) {
      const cleanup = await client.delete(key);
      console.log(JSON.stringify({ stage: "diagnostic-cleanup", ...summarize(cleanup) }));
      if (!cleanup.ok) throw new Error("Diagnostic object cleanup failed.");
    }
  }
}
main().catch(() => { console.error("Development storage verification failed; no configuration changed."); process.exitCode = 1; });
