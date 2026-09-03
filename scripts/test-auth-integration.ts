#!/usr/bin/env tsx
/**
 * scripts/test-auth-integration.ts
 *
 * Auth login + session restore integration tests.
 * Runs against a live server at BASE_URL (default: http://localhost:5000).
 *
 * Test cases:
 *   1. Missing credentials          → 400
 *   2. Wrong email (non-existent)   → 401
 *   3. Wrong password               → 401
 *   4. Valid login                  → 200 + authToken
 *   5. Session restore via token    → 200 + user profile
 *   6. Session restore bad token    → 401
 *
 * The script creates a temporary test account, runs all checks, then deletes
 * the account so it leaves no permanent state. Exit code: 0 = all pass, 1 = any fail.
 *
 * Usage:
 *   npx tsx scripts/test-auth-integration.ts [--base-url http://localhost:5000]
 */

const BASE_URL = (() => {
  const idx = process.argv.indexOf("--base-url");
  return idx !== -1 ? process.argv[idx + 1] : "http://localhost:5000";
})();

// Unique per-run so parallel runs don't collide
const RUN_ID = Date.now().toString(36);
const TEST_EMAIL = `auth-test-${RUN_ID}@integration.mpm.internal`;
const TEST_PASSWORD = `IntegrationTest!${RUN_ID}`;  // >= 12 chars, unique

interface Result {
  label: string;
  pass: boolean;
  detail: string;
}

const results: Result[] = [];
let testAuthToken = "";

function pass(label: string, detail = ""): void {
  results.push({ label, pass: true, detail });
  console.log(`  ✅ PASS  ${label}${detail ? " — " + detail : ""}`);
}

function fail(label: string, detail = ""): void {
  results.push({ label, pass: false, detail });
  console.log(`  ❌ FAIL  ${label}${detail ? " — " + detail : ""}`);
}

async function post(path: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  let json: unknown = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}

async function deleteReq(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers });
  return { status: res.status };
}

// ─── Test 1: Missing credentials → 400 ───────────────────────────────────────
async function testMissingCredentials() {
  const label = "POST /api/auth/login — missing credentials → 400";
  try {
    const { status, json } = await post("/api/auth/login", {});
    if (status === 400) {
      pass(label, `status=${status}`);
    } else {
      fail(label, `expected 400 got ${status} body=${JSON.stringify(json)}`);
    }
  } catch (e: unknown) {
    fail(label, `fetch error: ${String(e)}`);
  }
}

// ─── Test 2: Non-existent email → 401 ────────────────────────────────────────
async function testNonExistentEmail() {
  const label = "POST /api/auth/login — unknown email → 401";
  try {
    const { status, json } = await post("/api/auth/login", {
      email: `no-such-user-${RUN_ID}@nowhere.invalid`,
      password: "SomePassword123!",
    });
    if (status === 401) {
      pass(label, `status=${status}`);
    } else {
      fail(label, `expected 401 got ${status} body=${JSON.stringify(json)}`);
    }
  } catch (e: unknown) {
    fail(label, `fetch error: ${String(e)}`);
  }
}

// ─── Create temp test user ────────────────────────────────────────────────────
async function createTestUser(): Promise<boolean> {
  const label = "Setup: create temporary test user via /api/auth/signup";
  try {
    const { status, json } = await post("/api/auth/signup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (status === 200 || status === 201) {
      pass(label, `userId=${(json as Record<string, unknown>)?.id}`);
      // Store token for session test; also needed for cleanup
      testAuthToken = ((json as Record<string, unknown>)?.authToken as string) || "";
      return true;
    } else {
      fail(label, `expected 200/201 got ${status} body=${JSON.stringify(json)}`);
      return false;
    }
  } catch (e: unknown) {
    fail(label, `fetch error: ${String(e)}`);
    return false;
  }
}

// ─── Test 3: Wrong password → 401 ────────────────────────────────────────────
async function testWrongPassword() {
  const label = "POST /api/auth/login — wrong password → 401";
  try {
    const { status, json } = await post("/api/auth/login", {
      email: TEST_EMAIL,
      password: "TotallyWrongPassw0rd!",
    });
    if (status === 401) {
      pass(label, `status=${status}`);
    } else {
      fail(label, `expected 401 got ${status} body=${JSON.stringify(json)}`);
    }
  } catch (e: unknown) {
    fail(label, `fetch error: ${String(e)}`);
  }
}

// ─── Test 4: Valid login → 200 + authToken ────────────────────────────────────
async function testValidLogin(): Promise<boolean> {
  const label = "POST /api/auth/login — valid credentials → 200 + authToken";
  try {
    const { status, json } = await post("/api/auth/login", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const body = json as Record<string, unknown> | null;
    if (status === 200 && typeof body?.authToken === "string" && body.authToken.length > 0) {
      testAuthToken = body.authToken as string;
      pass(label, `status=${status}, tokenPrefix=${testAuthToken.slice(0, 8)}…`);
      return true;
    } else {
      fail(label, `status=${status}, hasToken=${typeof body?.authToken}, body=${JSON.stringify(json)}`);
      return false;
    }
  } catch (e: unknown) {
    fail(label, `fetch error: ${String(e)}`);
    return false;
  }
}

// ─── Test 5: Session restore with valid token → 200 + user profile ────────────
async function testSessionRestore() {
  const label = "GET /api/auth/session — valid token → 200 + profile";
  if (!testAuthToken) {
    fail(label, "skipped — no auth token from login test");
    return;
  }
  try {
    const { status, json } = await get("/api/auth/session", {
      "x-auth-token": testAuthToken,
    });
    const body = json as Record<string, unknown> | null;
    const hasProfile = status === 200 && body?.email === TEST_EMAIL.toLowerCase();
    if (hasProfile) {
      pass(label, `status=${status}, email=${body?.email}`);
    } else {
      fail(label, `status=${status}, body=${JSON.stringify(json)}`);
    }
  } catch (e: unknown) {
    fail(label, `fetch error: ${String(e)}`);
  }
}

// ─── Test 6: Session restore with bad token → 401 ────────────────────────────
async function testSessionBadToken() {
  const label = "GET /api/auth/session — invalid token → 401";
  try {
    const { status } = await get("/api/auth/session", {
      "x-auth-token": "totally-invalid-token-that-does-not-exist",
    });
    if (status === 401) {
      pass(label, `status=${status}`);
    } else {
      fail(label, `expected 401 got ${status}`);
    }
  } catch (e: unknown) {
    fail(label, `fetch error: ${String(e)}`);
  }
}

// ─── Cleanup: delete the test account ────────────────────────────────────────
async function cleanupTestUser() {
  if (!testAuthToken) return;
  try {
    const { status } = await deleteReq("/api/auth/delete-account", {
      "x-auth-token": testAuthToken,
    });
    if (status === 204 || status === 200) {
      console.log(`  🧹 Cleanup: test user deleted (status=${status})`);
    } else {
      console.warn(`  ⚠️  Cleanup: delete returned ${status} — test user may need manual removal`);
      console.warn(`     email: ${TEST_EMAIL}`);
    }
  } catch (e: unknown) {
    console.warn(`  ⚠️  Cleanup: delete-account request failed — ${String(e)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log("  Auth Integration Tests");
  console.log(`  Target: ${BASE_URL}`);
  console.log("");

  // Tests that don't require a real user
  await testMissingCredentials();
  await testNonExistentEmail();

  // Create temp user for the remaining tests
  const created = await createTestUser();
  if (created) {
    await testWrongPassword();
    await testValidLogin();
    await testSessionRestore();
    await testSessionBadToken();
    await cleanupTestUser();
  } else {
    // Still run the error-path tests even if signup failed (route must be mounted)
    console.log("  ⚠️  Skipping per-user tests (signup failed)");
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;

  console.log("");
  if (failed === 0) {
    console.log(`  ✅ All ${total} auth integration checks passed`);
    process.exit(0);
  } else {
    console.log(`  ❌ ${failed}/${total} auth integration checks FAILED`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`     • ${r.label}${r.detail ? " — " + r.detail : ""}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("  ❌ Auth integration test runner crashed:", e);
  process.exit(1);
});
