// server/services/storageStartupDiagnostic.ts
// Development-only startup diagnostic for the image upload pipeline.
// Runs automatically at server boot when NODE_ENV !== 'production'.
// NOT exposed as an HTTP endpoint. Remove after storage is proven stable.
//
// Tests two paths in order:
//   1. uploadImageToPermanentStorage() — the current production path
//      (S3 → sidecar signed-URL fallback)
//   2. objectStorageClient GCS SDK direct write — the authenticated fallback
//      that uses the same credentials as the rest of the Object Storage service
//
// Reports which path succeeded/failed and why, so the result is visible in
// server startup logs without any external request being needed.

import crypto from "crypto";
import { objectStorageClient } from "../objectStorage";
import { uploadImageToPermanentStorage } from "./permanentImageStorage";

// Tiny 1×1 white PNG (68 bytes). Self-contained; no network fetch needed.
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==";
const TINY_PNG_DATA_URI = `data:image/png;base64,${TINY_PNG_B64}`;
const TINY_PNG_BYTES = Buffer.from(TINY_PNG_B64, "base64");

function getPublicBucketName(): string | null {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!paths.length) return null;
  // Path format: /bucket-name/prefix  →  strip leading slash, take first segment
  return paths[0].replace(/^\/+/, "").split("/")[0] || null;
}

async function testCurrentUploadPath(
  tag: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const result = await uploadImageToPermanentStorage({
      imageUrl: TINY_PNG_DATA_URI,
      mealName: `storage-diagnostic-${tag}`,
      imageHash: `diag-${tag}`,
    });
    return { success: true, url: result.permanentUrl };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Wrap any promise with a timeout so a hanging sidecar doesn't freeze the diagnostic.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

async function probeSidecarEndpoints(): Promise<void> {
  const SIDECAR = "http://127.0.0.1:1106";
  const endpoints = ["/credential", "/token", "/object-storage/signed-object-url"];

  console.log("│   Sidecar endpoint probe:");
  for (const ep of endpoints) {
    try {
      const res = await withTimeout(
        fetch(`${SIDECAR}${ep}`, {
          method: ep === "/object-storage/signed-object-url" ? "POST" : "GET",
          headers: { "Content-Type": "application/json" },
          body: ep === "/object-storage/signed-object-url"
            ? JSON.stringify({ bucket_name: "test", object_name: "test", method: "PUT", expires_at: new Date(Date.now() + 60000).toISOString() })
            : undefined,
        }),
        5000,
        ep
      );
      console.log(`│     ${ep} → HTTP ${res.status} ${res.statusText}`);
    } catch (err: any) {
      console.log(`│     ${ep} → ❌ ${err.message}`);
    }
  }
}

async function testGCSSDKPath(
  tag: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const bucketName = getPublicBucketName();
  if (!bucketName) {
    return {
      success: false,
      error:
        "PUBLIC_OBJECT_SEARCH_PATHS not configured — cannot resolve bucket name",
    };
  }

  const objectName = `meal-images/storage-diagnostic-${tag}.png`;

  try {
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    // Upload via GCS SDK (authenticated via sidecar /credential + /token).
    // Timeout after 12 s — if credential fetch hangs we surface that explicitly.
    await withTimeout(
      file.save(TINY_PNG_BYTES, {
        contentType: "image/png",
        metadata: {
          cacheControl: "public, max-age=31536000",
          customMetadata: { purpose: "storage-diagnostic", tag },
        },
      }),
      12000,
      "file.save()"
    );

    // Verify the object exists and is the right size
    const [exists] = await withTimeout(file.exists(), 8000, "file.exists()");
    if (!exists) {
      return {
        success: false,
        error: "Upload appeared to succeed but object does not exist afterward",
      };
    }

    const [metadata] = await withTimeout(file.getMetadata(), 8000, "file.getMetadata()");
    const storedSize = parseInt(String(metadata.size || "0"), 10);
    const expectedSize = TINY_PNG_BYTES.length;
    if (storedSize !== expectedSize) {
      return {
        success: false,
        error: `Size mismatch: expected ${expectedSize} bytes, got ${storedSize}`,
      };
    }

    // Clean up the diagnostic object (non-fatal)
    await file.delete().catch(() => { /* non-fatal */ });

    return { success: true, url: `/public-objects/${objectName}` };
  } catch (err: any) {
    const code = err.code ?? err.statusCode ?? "no-code";
    const msg = (err.message ?? "no-message").substring(0, 200);
    return { success: false, error: `[${code}] ${msg}` };
  }
}

export async function runStorageStartupDiagnostic(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const tag = crypto.randomBytes(4).toString("hex");

  console.log("┌─────────────────────────────────────────────────────────");
  console.log("│ [Storage Diagnostic] Starting image upload pipeline test");
  console.log(`│ Tag: ${tag}`);
  console.log(
    `│ S3_BUCKET_NAME             : ${process.env.S3_BUCKET_NAME || "❌ MISSING"}`
  );
  console.log(
    `│ AWS_REGION                 : ${process.env.AWS_REGION || "❌ MISSING"}`
  );
  console.log(
    `│ AWS_ACCESS_KEY_ID          : ${process.env.AWS_ACCESS_KEY_ID ? "SET (" + process.env.AWS_ACCESS_KEY_ID.slice(0, 8) + "…)" : "❌ MISSING"}`
  );
  console.log(
    `│ PUBLIC_OBJECT_SEARCH_PATHS : ${process.env.PUBLIC_OBJECT_SEARCH_PATHS || "❌ MISSING"}`
  );
  console.log(
    `│ Resolved bucket            : ${getPublicBucketName() || "❌ could not resolve"}`
  );
  console.log("│");

  // ── SIDECAR HEALTH CHECK ─────────────────────────────────────────────────
  console.log("│ [Sidecar probe] Testing sidecar endpoint availability …");
  await probeSidecarEndpoints();
  console.log("│");

  // ── PATH 1: uploadImageToPermanentStorage() (server production path) ─────
  console.log("│ [Path 1] uploadImageToPermanentStorage() — production server path …");
  const path1 = await testCurrentUploadPath(tag);
  if (path1.success) {
    console.log(`│   ✅ SUCCEEDED  → ${path1.url}`);
    console.log(
      "│   Path type   :",
      path1.url?.startsWith("http")
        ? "S3 (absolute URL)"
        : "Replit Object Storage (relative path)"
    );
  } else {
    console.log(`│   ❌ FAILED     → ${path1.error}`);
  }

  // ── PATH 2: objectStorageClient GCS SDK direct write ─────────────────────
  console.log("│");
  console.log("│ [Path 2] objectStorageClient GCS SDK direct write …");
  const path2 = await testGCSSDKPath(tag);
  if (path2.success) {
    console.log(`│   ✅ SUCCEEDED  → ${path2.url}`);
    console.log(
      "│   Verified     : object exists + correct byte count + deleted after test"
    );
  } else {
    console.log(`│   ❌ FAILED     → ${path2.error}`);
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log("│");
  if (!path1.success && !path2.success) {
    console.log(
      "│ ⛔ RESULT: BOTH storage paths are broken from server process context."
    );
    console.log(
      "│    Migration of existing base64 images is BLOCKED until storage is repaired."
    );
    console.log(
      "│    Review S3 IAM policy and GCS sidecar credentials before proceeding."
    );
  } else if (path1.success) {
    console.log(
      "│ ✅ RESULT: Current upload path (Path 1) works from server context."
    );
    console.log(
      "│    Image migration may proceed. GCS 401 was probe-context-specific."
    );
  } else {
    console.log(
      "│ ⚠️  RESULT: Path 1 broken but Path 2 (GCS SDK) works from server context."
    );
    console.log(
      "│    permanentImageStorage.ts should be updated to use objectStorageClient"
    );
    console.log(
      "│    (the authenticated GCS SDK path) instead of the sidecar signed-URL approach."
    );
  }
  console.log("└─────────────────────────────────────────────────────────");
}
