#!/usr/bin/env tsx
/**
 * Audited, exact-key meal-image delta migration.
 *
 * Build the persistent manifest from a reviewed discovery report:
 *   npx tsx scripts/migrate-meal-image-delta.ts \
 *     --build-manifest /tmp/mpm-image-delta-dry-run.json \
 *     --manifest storage-migrations/meal-images-delta-2026-09-07.json
 *
 * Revalidate without writing:
 *   npx tsx scripts/migrate-meal-image-delta.ts --manifest <path> \
 *     --source-origin <working-development-origin> \
 *     --destination-origin https://app.myperfectmeals.com --dry-run
 *
 * Execute only from the Production-owned storage environment:
 *   npx tsx scripts/migrate-meal-image-delta.ts --manifest <path> \
 *     --source-origin <working-development-origin> \
 *     --destination-origin https://app.myperfectmeals.com --execute
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { Storage } from "@google-cloud/storage";

const DEV_BUCKET = "replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b";
const PROD_BUCKET = "replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491";
const EXPECTED = {
  candidates: 873,
  missing: 777,
  identical: 96,
  conflicts: 0,
  errors: 0,
  bytes: 200_887_177,
} as const;

type Disposition = "copy" | "skip-identical";
type ManifestObject = {
  key: string;
  sourceBucket: string;
  destinationBucket: string;
  sourceSizeBytes: number;
  sourceMd5Hash: string;
  contentType: string;
  expectedDisposition: Disposition;
};
type DeltaManifest = {
  schemaVersion: 1;
  generatedAt: string;
  cutoff: string;
  sourceBucket: string;
  destinationBucket: string;
  expected: typeof EXPECTED;
  objects: ManifestObject[];
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function md5(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("base64");
}

function cleanOrigin(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Origin must use HTTP or HTTPS");
  }
  return parsed.origin;
}

function objectUrl(origin: string, bucket: string, key: string): string {
  return `${origin}/public-objects/${bucket}/${key}`;
}

async function fetchObject(
  origin: string,
  bucket: string,
  object: ManifestObject,
  cacheNonce: string,
): Promise<{ status: number; bytes?: Buffer; contentType?: string }> {
  const response = await fetch(
    `${objectUrl(origin, bucket, object.key)}?migration-check=${cacheNonce}`,
    {
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (response.status === 404) {
    await response.arrayBuffer();
    return { status: 404 };
  }
  if (response.status !== 200) {
    const body = (await response.text()).slice(0, 160);
    throw new Error(`${object.key}: HTTP ${response.status}: ${body}`);
  }
  return {
    status: 200,
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? undefined,
  };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  callback: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await callback(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return output;
}

function assertManifest(manifest: DeltaManifest): void {
  if (
    manifest.sourceBucket !== DEV_BUCKET ||
    manifest.destinationBucket !== PROD_BUCKET
  ) {
    throw new Error("Manifest bucket IDs do not match canonical buckets");
  }
  if (manifest.objects.length !== EXPECTED.candidates) {
    throw new Error(
      `Manifest candidate count changed: ${manifest.objects.length}`,
    );
  }
  const uniqueKeys = new Set(manifest.objects.map((object) => object.key));
  if (uniqueKeys.size !== manifest.objects.length) {
    throw new Error("Manifest contains duplicate object keys");
  }
  for (const object of manifest.objects) {
    if (
      !object.key.startsWith("meal-images/") ||
      object.sourceBucket !== DEV_BUCKET ||
      object.destinationBucket !== PROD_BUCKET ||
      !Number.isSafeInteger(object.sourceSizeBytes) ||
      object.sourceSizeBytes < 0 ||
      !object.sourceMd5Hash ||
      !object.contentType
    ) {
      throw new Error(`Invalid manifest entry: ${object.key}`);
    }
  }
}

function buildManifest(discoveryPath: string, manifestPath: string): void {
  const discovery = JSON.parse(readFileSync(discoveryPath, "utf8"));
  const summary = discovery.summary;
  if (
    summary.candidateKeys !== EXPECTED.candidates ||
    summary.missing !== EXPECTED.missing ||
    summary.alreadyPresentIdentical !== EXPECTED.identical ||
    summary.conflicts !== EXPECTED.conflicts ||
    summary.probeErrors !== EXPECTED.errors ||
    summary.totalBytesToCopy !== EXPECTED.bytes
  ) {
    throw new Error("Reviewed discovery report no longer matches authorization");
  }
  const objects: ManifestObject[] = discovery.results
    .map((object: any) => ({
      key: object.key,
      sourceBucket: DEV_BUCKET,
      destinationBucket: PROD_BUCKET,
      sourceSizeBytes: object.sizeBytes,
      sourceMd5Hash: object.md5Hash,
      contentType: object.contentType,
      expectedDisposition:
        object.classification === "missing" ? "copy" : "skip-identical",
    }))
    .sort((a: ManifestObject, b: ManifestObject) =>
      a.key.localeCompare(b.key),
    );
  const manifest: DeltaManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    cutoff: summary.cutoff,
    sourceBucket: DEV_BUCKET,
    destinationBucket: PROD_BUCKET,
    expected: EXPECTED,
    objects,
  };
  assertManifest(manifest);
  mkdirSync(dirname(resolve(manifestPath)), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { mode: "build-manifest", manifestPath, objects: objects.length },
      null,
      2,
    ),
  );
}

type CheckResult = {
  key: string;
  disposition: "missing" | "identical" | "conflict" | "error";
  sourceBytes?: Buffer;
  error?: string;
};

async function verifyInventory(
  manifest: DeltaManifest,
  sourceOrigin: string,
  destinationOrigin: string,
  retainMissingBytes: boolean,
): Promise<{ results: CheckResult[]; summary: Record<string, number> }> {
  const nonce = Date.now().toString(36);
  const results = await mapLimit(manifest.objects, 12, async (object) => {
    try {
      const source = await fetchObject(
        sourceOrigin,
        DEV_BUCKET,
        object,
        nonce,
      );
      if (!source.bytes) throw new Error(`${object.key}: source is missing`);
      if (
        source.bytes.length !== object.sourceSizeBytes ||
        md5(source.bytes) !== object.sourceMd5Hash
      ) {
        throw new Error(`${object.key}: source differs from reviewed manifest`);
      }

      const destination = await fetchObject(
        destinationOrigin,
        PROD_BUCKET,
        object,
        nonce,
      );
      if (destination.status === 404) {
        return {
          key: object.key,
          disposition: "missing" as const,
          sourceBytes: retainMissingBytes ? source.bytes : undefined,
        };
      }
      if (!destination.bytes) {
        throw new Error(`${object.key}: destination returned no bytes`);
      }
      const identical =
        destination.bytes.length === object.sourceSizeBytes &&
        md5(destination.bytes) === object.sourceMd5Hash;
      return {
        key: object.key,
        disposition: identical ? ("identical" as const) : ("conflict" as const),
      };
    } catch (error) {
      return {
        key: object.key,
        disposition: "error" as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  const summary = {
    candidates: results.length,
    missing: results.filter((result) => result.disposition === "missing").length,
    identical: results.filter((result) => result.disposition === "identical")
      .length,
    conflicts: results.filter((result) => result.disposition === "conflict")
      .length,
    errors: results.filter((result) => result.disposition === "error").length,
    bytes: results
      .filter((result) => result.disposition === "missing")
      .reduce(
        (total, result) =>
          total +
          manifest.objects.find((object) => object.key === result.key)!
            .sourceSizeBytes,
        0,
      ),
  };
  return { results, summary };
}

function assertAuthorizedDryRun(summary: Record<string, number>): void {
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (summary[key] !== expected) {
      throw new Error(
        `Pre-execution gate changed: ${key}=${summary[key]}, expected ${expected}`,
      );
    }
  }
}

function productionStorage(): Storage {
  if (
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID !== PROD_BUCKET ||
    process.env.NODE_ENV !== "production"
  ) {
    throw new Error(
      "Execution refused: this process is not bound to the canonical Production bucket",
    );
  }
  const endpoint = "http://127.0.0.1:1106";
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${endpoint}/token`,
      type: "external_account",
      credential_source: {
        url: `${endpoint}/credential`,
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
}

async function executeMigration(
  manifest: DeltaManifest,
  sourceOrigin: string,
  destinationOrigin: string,
): Promise<void> {
  const preflight = await verifyInventory(
    manifest,
    sourceOrigin,
    destinationOrigin,
    false,
  );
  console.log(JSON.stringify({ mode: "pre-execution", ...preflight.summary }));
  assertAuthorizedDryRun(preflight.summary);

  const storage = productionStorage();
  const bucket = storage.bucket(PROD_BUCKET);
  const copyObjects = manifest.objects.filter(
    (object) => object.expectedDisposition === "copy",
  );
  const results: Array<Record<string, unknown>> = [];
  for (const [index, object] of copyObjects.entries()) {
    const source = await fetchObject(
      sourceOrigin,
      DEV_BUCKET,
      object,
      `copy-${Date.now()}-${index}`,
    );
    if (
      !source.bytes ||
      source.bytes.length !== object.sourceSizeBytes ||
      md5(source.bytes) !== object.sourceMd5Hash
    ) {
      throw new Error(`${object.key}: source verification failed before copy`);
    }

    try {
      await bucket.file(object.key).save(source.bytes, {
        resumable: false,
        contentType: object.contentType,
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (error: any) {
      if (error?.code === 412) {
        throw new Error(
          `${object.key}: destination appeared during migration; stopped without overwrite`,
        );
      }
      throw error;
    }

    const verified = await fetchObject(
      destinationOrigin,
      PROD_BUCKET,
      object,
      `verify-${Date.now()}-${index}`,
    );
    if (
      !verified.bytes ||
      verified.bytes.length !== object.sourceSizeBytes ||
      md5(verified.bytes) !== object.sourceMd5Hash
    ) {
      throw new Error(`${object.key}: post-copy verification failed`);
    }
    results.push({
      key: object.key,
      result: "copied-verified",
      bytes: object.sourceSizeBytes,
      md5Hash: object.sourceMd5Hash,
    });
    if ((index + 1) % 25 === 0 || index + 1 === copyObjects.length) {
      console.log(`Copied and verified ${index + 1}/${copyObjects.length}`);
    }
  }

  const postflight = await verifyInventory(
    manifest,
    sourceOrigin,
    destinationOrigin,
    false,
  );
  const expectedFinal = {
    candidates: EXPECTED.candidates,
    missing: 0,
    identical: EXPECTED.candidates,
    conflicts: 0,
    errors: 0,
    bytes: 0,
  };
  for (const [key, expected] of Object.entries(expectedFinal)) {
    if (postflight.summary[key] !== expected) {
      throw new Error(
        `Post-migration verification failed: ${key}=${postflight.summary[key]}, expected ${expected}`,
      );
    }
  }
  const reportPath = resolve(
    "storage-migrations/meal-images-delta-2026-09-07.results.json",
  );
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        copied: results.length,
        skippedIdentical: EXPECTED.identical,
        bytesCopied: EXPECTED.bytes,
        final: postflight.summary,
        objects: results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(JSON.stringify({ mode: "execute", reportPath, ...postflight.summary }));
}

async function main(): Promise<void> {
  const manifestPath = arg("--manifest");
  const buildFrom = arg("--build-manifest");
  if (!manifestPath) throw new Error("--manifest is required");
  if (buildFrom) {
    buildManifest(buildFrom, manifestPath);
    return;
  }

  const sourceOriginArg = arg("--source-origin");
  const destinationOriginArg = arg("--destination-origin");
  if (!sourceOriginArg || !destinationOriginArg) {
    throw new Error("--source-origin and --destination-origin are required");
  }
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as DeltaManifest;
  assertManifest(manifest);
  const sourceOrigin = cleanOrigin(sourceOriginArg);
  const destinationOrigin = cleanOrigin(destinationOriginArg);

  if (flag("--execute")) {
    await executeMigration(
      manifest,
      sourceOrigin,
      destinationOrigin,
    );
    return;
  }
  if (!flag("--dry-run")) throw new Error("Choose --dry-run or --execute");
  const checked = await verifyInventory(
    manifest,
    sourceOrigin,
    destinationOrigin,
    false,
  );
  console.log(JSON.stringify({ mode: "dry-run", ...checked.summary }, null, 2));
  assertAuthorizedDryRun(checked.summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});