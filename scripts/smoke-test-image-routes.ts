/**
 * smoke-test-image-routes.ts
 *
 * End-to-end smoke test for the server-inline image generation pipeline.
 * Exercises the three routes that switched from client-fetch to server-inline:
 *   - POST /api/craving-creator/generate
 *   - POST /api/meals/dessert-creator
 *   - POST /api/meals/beverage-creator
 *
 * Asserts on each response:
 *   1. HTTP 200 with a parseable JSON body
 *   2. imageUrl is a non-null string, OR null (graceful DALL-E failure)
 *   3. imageUrl — when present — is NOT a temporary openai/azure CDN URL
 *   4. imageUrl is an S3 HTTPS URL, not a base64 data URI (advisory warning if violated)
 *   5. Cache round: a repeat call to /api/meals/generate-image with the same
 *      meal name returns in ≤ 2 s — confirming the in-memory cache layer works.
 *
 * Usage:
 *   npx tsx scripts/smoke-test-image-routes.ts [BASE_URL] [AUTH_TOKEN]
 *
 *   BASE_URL    defaults to http://localhost:5000
 *   AUTH_TOKEN  can also be set via the SMOKE_AUTH_TOKEN env variable.
 *               Obtain a token from the database:
 *                 SELECT auth_token FROM users WHERE email = '<your-email>' LIMIT 1;
 *               All three routes require an authenticated session.
 *
 * Examples:
 *   SMOKE_AUTH_TOKEN=abc123 npx tsx scripts/smoke-test-image-routes.ts
 *   npx tsx scripts/smoke-test-image-routes.ts http://localhost:5000 abc123
 */

const BASE_URL = process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2]
  : "http://localhost:5000";

const AUTH_TOKEN: string | undefined =
  process.argv[3] ||
  process.env.SMOKE_AUTH_TOKEN;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEMP_URL_PATTERNS = [
  "oaidalleapiprodscus",
  "blob.core.windows.net",
  "openai.com/v1",
];

function isTempUrl(url: string): boolean {
  return TEMP_URL_PATTERNS.some((p) => url.includes(p));
}

function isS3Url(url: string): boolean {
  const bucket = process.env.S3_BUCKET_NAME || "my-perfect-meals-images";
  return url.startsWith(`https://${bucket}.s3.`) || url.includes("amazonaws.com");
}

interface ImageCheck {
  pass: boolean;
  advisory: boolean;
  reason?: string;
}

function checkImageValue(value: unknown): ImageCheck {
  if (value === null || value === undefined) {
    return { pass: true, advisory: false }; // graceful null is acceptable
  }
  if (typeof value !== "string") {
    return { pass: false, advisory: false, reason: `imageUrl is ${typeof value}, expected string or null` };
  }
  if (value === "") {
    return { pass: false, advisory: false, reason: "imageUrl is an empty string — should be null, not empty" };
  }
  if (isTempUrl(value)) {
    return { pass: false, advisory: false, reason: `imageUrl is a temporary expiring CDN URL: ${value.substring(0, 80)}…` };
  }
  if (value.startsWith("data:")) {
    return {
      pass: true,
      advisory: true,
      reason: "imageUrl is a base64 data URI — S3 upload may have failed. Expected an https:// S3 URL.",
    };
  }
  if (!isS3Url(value) && value.startsWith("https://")) {
    return {
      pass: true,
      advisory: true,
      reason: `imageUrl is an HTTPS URL not on the expected S3 bucket: ${value.substring(0, 80)}`,
    };
  }
  return { pass: true, advisory: false };
}

interface TestResult {
  label: string;
  pass: boolean;
  skipped: boolean;
  advisory: boolean;
  imageUrl: string | null | undefined;
  mealName: string | null | undefined;
  durationMs: number;
  error?: string;
  advisoryNote?: string;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) {
    headers["x-auth-token"] = AUTH_TOKEN;
  }
  return headers;
}

async function post(
  path: string,
  body: object
): Promise<{ status: number; json: any; durationMs: number }> {
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  const durationMs = Date.now() - t0;
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json, durationMs };
}

async function runTest(
  label: string,
  path: string,
  body: object,
  imageUrlExtractor: (json: any) => unknown,
  mealNameExtractor?: (json: any) => string | null | undefined
): Promise<TestResult> {
  let pass = true;
  let advisory = false;
  let skipped = false;
  let error: string | undefined;
  let advisoryNote: string | undefined;
  let imageUrl: string | null | undefined;
  let mealName: string | null | undefined;
  let durationMs = 0;

  try {
    const { status, json, durationMs: ms } = await post(path, body);
    durationMs = ms;

    if (status === 401 || status === 403) {
      skipped = true;
      pass = false;
      error = `HTTP ${status} — authentication required. Provide a valid AUTH_TOKEN.`;
      return { label, pass, skipped, advisory, imageUrl, mealName, durationMs, error };
    }
    if (status !== 200) {
      pass = false;
      error = `HTTP ${status} — expected 200. Body: ${JSON.stringify(json ?? {}).substring(0, 120)}`;
      return { label, pass, skipped, advisory, imageUrl, mealName, durationMs, error };
    }
    if (!json) {
      pass = false;
      error = "Response body is not valid JSON";
      return { label, pass, skipped, advisory, imageUrl, mealName, durationMs, error };
    }

    const rawValue = imageUrlExtractor(json);
    imageUrl = rawValue as string | null | undefined;
    mealName = mealNameExtractor ? mealNameExtractor(json) : undefined;

    const check = checkImageValue(rawValue);
    if (!check.pass) {
      pass = false;
      error = check.reason;
    } else if (check.advisory) {
      advisory = true;
      advisoryNote = check.reason;
    }
  } catch (err: any) {
    pass = false;
    error = `Fetch error: ${err.message}`;
  }

  return { label, pass, skipped, advisory, imageUrl, mealName, durationMs, error, advisoryNote };
}

/**
 * Cache test: call /api/meals/generate-image twice with the same mealName.
 * The first call populates the server in-memory cache; the second must return in < 2 s.
 */
async function runCacheTest(
  label: string,
  mealName: string,
  sourceType: "meal" | "dessert" | "beverage"
): Promise<TestResult> {
  const CACHE_THRESHOLD_MS = 2000;
  const imgBody = { mealName, sourceType, ingredients: [] };

  let pass = true;
  let advisory = false;
  let skipped = false;
  let error: string | undefined;
  let advisoryNote: string | undefined;
  let imageUrl: string | null | undefined;
  let durationMs = 0;

  try {
    // First call — may be a cache miss (if the full route used different ingredients)
    const first = await post("/api/meals/generate-image", imgBody);
    if (first.status === 401 || first.status === 403) {
      skipped = true;
      pass = false;
      error = `HTTP ${first.status} — skipping cache check (auth required)`;
      return { label, pass, skipped, advisory, imageUrl, mealName, durationMs, error };
    }

    // Second call with identical body — must hit the in-memory cache
    const second = await post("/api/meals/generate-image", imgBody);
    durationMs = second.durationMs;

    if (second.status !== 200 || !second.json) {
      pass = false;
      error = `Cache-check HTTP ${second.status} — expected 200`;
      return { label, pass, skipped, advisory, imageUrl, mealName, durationMs, error };
    }

    imageUrl = second.json?.imageUrl;

    if (second.durationMs > CACHE_THRESHOLD_MS) {
      pass = false;
      error = `Cache miss — 2nd call took ${second.durationMs} ms (threshold: ${CACHE_THRESHOLD_MS} ms). Expected memCache hit.`;
    }

    const check = checkImageValue(imageUrl);
    if (!check.pass) {
      pass = false;
      error = (error ? error + "; " : "") + check.reason;
    } else if (check.advisory) {
      advisory = true;
      advisoryNote = check.reason;
    }
  } catch (err: any) {
    pass = false;
    error = `Fetch error: ${err.message}`;
  }

  return { label, pass, skipped, advisory, imageUrl, mealName, durationMs, error, advisoryNote };
}

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const CRAVING_BODY = {
  craving: "spicy chicken tacos",
  mealType: "dinner",
  servings: 2,
};

const DESSERT_BODY = {
  dessertCategory: "cookies",
  flavorFamily: "chocolate",
  specificDessert: "double chocolate chip cookies",
  servingSize: "two",
  dietaryPreferences: [],
};

const BEVERAGE_BODY = {
  beverageCategory: "smoothie",
  flavorFamily: "berry",
  specificDrink: "mixed berry protein smoothie",
  servingSize: "single",
  dietaryPreferences: [],
};

// ─── Output helpers ───────────────────────────────────────────────────────────

function printResult(result: TestResult, isCache = false) {
  const label = isCache ? `${result.label} [cache]` : result.label;

  let icon: string;
  if (result.skipped) icon = "⏭️";
  else if (!result.pass) icon = "❌";
  else if (result.advisory) icon = "⚠️";
  else icon = "✅";

  const urlLine =
    result.imageUrl == null
      ? `  imageUrl: ${result.imageUrl === null ? "null (graceful fallback — acceptable)" : "(field absent from response)"}`
      : `  imageUrl: ${result.imageUrl.substring(0, 90)}${result.imageUrl.length > 90 ? "…" : ""}`;

  console.log(`${icon} ${label} — ${result.durationMs} ms`);
  console.log(urlLine);
  if (result.mealName && !isCache) {
    console.log(`  mealName (AI-generated): "${result.mealName}"`);
  }
  if (result.advisoryNote) {
    console.log(`   ℹ  ${result.advisoryNote}`);
  }
  if (result.error) {
    console.log(`   ⚠  ${result.error}`);
  }
  console.log();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Image-route smoke test — ${BASE_URL}`);
  console.log("\nRound 1: Full route generation (15–60 s per route — DALL-E + S3 upload).");
  console.log("Round 2: Cache check — two sequential /api/meals/generate-image calls.");
  console.log("         2nd call must hit the in-memory cache (≤ 2 s).\n");

  const results: TestResult[] = [];

  // ── Round 1: Full route generation ───────────────────────────────────────
  console.log("── Round 1: Generation ───────────────────────────────────────────────────\n");

  const cravingR1 = await runTest(
    "POST /api/craving-creator/generate",
    "/api/craving-creator/generate",
    CRAVING_BODY,
    (j) => j?.meal?.imageUrl,
    (j) => j?.meal?.name
  );
  printResult(cravingR1);
  results.push(cravingR1);

  const dessertR1 = await runTest(
    "POST /api/meals/dessert-creator",
    "/api/meals/dessert-creator",
    DESSERT_BODY,
    (j) => j?.imageUrl,
    (j) => j?.name
  );
  printResult(dessertR1);
  results.push(dessertR1);

  const beverageR1 = await runTest(
    "POST /api/meals/beverage-creator",
    "/api/meals/beverage-creator",
    BEVERAGE_BODY,
    (j) => j?.imageUrl,
    (j) => j?.name
  );
  printResult(beverageR1);
  results.push(beverageR1);

  // ── Round 2: Image-cache warmth check ────────────────────────────────────
  // Two sequential calls to /api/meals/generate-image with the same meal name.
  // First call: warms the in-memory cache (may be a cache miss if ingredients differ).
  // Second call: must hit the in-memory cache (< 2 s).
  console.log("── Round 2: Cache (2× generate-image per name, 2nd must be ≤ 2 s) ────────\n");

  const cravingName = cravingR1.mealName ?? "Spicy Chicken Tacos";
  const dessertName = dessertR1.mealName ?? "Double Chocolate Chip Cookies";
  const beverageName = beverageR1.mealName ?? "Mixed Berry Protein Smoothie";

  const cravingCache = await runCacheTest(
    `generate-image mealName="${cravingName}"`,
    cravingName,
    "meal"
  );
  printResult(cravingCache, true);
  results.push(cravingCache);

  const dessertCache = await runCacheTest(
    `generate-image mealName="${dessertName}"`,
    dessertName,
    "dessert"
  );
  printResult(dessertCache, true);
  results.push(dessertCache);

  const beverageCache = await runCacheTest(
    `generate-image mealName="${beverageName}"`,
    beverageName,
    "beverage"
  );
  printResult(beverageCache, true);
  results.push(beverageCache);

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass && !r.advisory).length;
  const advisories = results.filter((r) => r.pass && r.advisory).length;
  const failed = results.filter((r) => !r.pass && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;

  console.log("─".repeat(70));
  console.log(
    `Result: ${passed} passed, ${advisories} advisory, ${failed} failed, ${skipped} skipped (${results.length} total)`
  );

  if (skipped > 0) {
    console.log("\nℹ️  Skipped tests require a valid auth token.");
    console.log("   Provide it via: SMOKE_AUTH_TOKEN=<token> npx tsx scripts/smoke-test-image-routes.ts");
    console.log("   Get a token: SELECT auth_token FROM users WHERE email = '<email>' LIMIT 1;");
  }

  if (advisories > 0) {
    console.log("\n⚠️  Advisory (non-fatal) issues:");
    results
      .filter((r) => r.pass && r.advisory)
      .forEach((r) => console.log(`  ⚠️  ${r.label}: ${r.advisoryNote}`));
    console.log(
      "\n   Advisory: imageUrl is a data: URI instead of an S3 URL.\n" +
      "   This means S3 upload failed. Check AWS credentials and bucket name.\n" +
      "   Fix: imageLifecycle.ts now routes data: URIs through S3 — redeploy and retest."
    );
  }

  if (failed > 0) {
    console.log("\nFailed checks:");
    results
      .filter((r) => !r.pass && !r.skipped)
      .forEach((r) => console.log(`  ❌ ${r.label}: ${r.error}`));
    process.exit(1);
  }

  if (skipped > 0 && passed === 0 && advisories === 0) {
    process.exit(2);
  }

  console.log("\nAll executable checks passed ✅");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
