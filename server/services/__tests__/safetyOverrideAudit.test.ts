/**
 * Safety Override Audit Row — integration test (Task 1147)
 *
 * Confirms that when a Safety PIN override is consumed through
 * enforceSafetyProfile, the resulting safety_override_audit_logs row:
 *  1. Is actually written to the DB (not silently dropped).
 *  2. Has correlation_id set to the value passed in SafetyOptions.
 *  3. The returned SafetyAssessment also carries the correlationId field.
 *
 * Requires a live DATABASE_URL.
 * Run: npx tsx server/services/__tests__/safetyOverrideAudit.test.ts
 *
 * All inserted rows (user + audit log) are removed on exit.
 */

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { users, safetyOverrideAuditLogs } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { verifyPinAndIssueOverrideToken } from "../safetyPinService";
import { enforceSafetyProfile } from "../safetyProfileService";

// ─────────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failMessages: string[] = [];
let testUserId: string | null = null;
const cleanupAuditIds: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = `  ❌ FAIL: ${label}`;
    console.log(msg);
    failMessages.push(msg);
  }
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶ ${title}`);
  console.log("─".repeat(60));
}

async function cleanup() {
  try {
    if (cleanupAuditIds.length > 0) {
      for (const id of cleanupAuditIds) {
        await db
          .delete(safetyOverrideAuditLogs)
          .where(eq(safetyOverrideAuditLogs.id, id));
      }
      console.log(`\n🧹 Cleaned up ${cleanupAuditIds.length} audit log row(s)`);
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
      console.log(`🧹 Cleaned up test user ${testUserId}`);
    }
  } catch (err) {
    console.error("⚠️  Cleanup failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Insert a minimal test user with a known allergy and Safety PIN. */
async function createTestUser(pin: string): Promise<string> {
  const userId = randomUUID();
  const pinHash = await bcrypt.hash(pin, 10); // low rounds — test only
  const uniqueSuffix = userId.slice(0, 8);

  await db.insert(users).values({
    id: userId,
    username: `test_safety_audit_${uniqueSuffix}`,
    email: `test_safety_audit_${uniqueSuffix}@example.invalid`,
    password: "test-placeholder",
    allergies: ["peanuts"],
    safetyPinHash: pinHash,
  });

  return userId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

async function testAuditRowWrittenWithCorrelationId() {
  section("Audit row written with correlationId after Safety PIN override");

  const TEST_PIN = "7391";
  const TEST_CORRELATION_ID = `test-corr-${randomUUID()}`;
  const BUILDER_ID = "craving-creator";
  const MEAL_REQUEST = "peanut butter and jelly sandwich";

  // 1 — Create user
  testUserId = await createTestUser(TEST_PIN);
  console.log(`  Created test user: ${testUserId}`);

  // 2 — Issue override token
  const tokenResult = await verifyPinAndIssueOverrideToken(
    testUserId,
    TEST_PIN,
    "peanuts",
    MEAL_REQUEST
  );
  assert(tokenResult.success, "verifyPinAndIssueOverrideToken returns success");
  assert(
    typeof tokenResult.overrideToken === "string" && tokenResult.overrideToken.length > 0,
    "overrideToken is a non-empty string"
  );

  if (!tokenResult.overrideToken) {
    console.log("  ⚠️  No override token issued — aborting remaining assertions");
    return;
  }

  // 3 — Call enforceSafetyProfile with the override token and a correlationId
  const assessment = await enforceSafetyProfile(
    testUserId,
    MEAL_REQUEST,
    BUILDER_ID,
    {
      safetyMode: "CUSTOM_AUTHENTICATED",
      overrideToken: tokenResult.overrideToken,
      correlationId: TEST_CORRELATION_ID,
    }
  );

  // 4 — Assert SafetyAssessment fields
  assert(assessment.result === "SAFE", "SafetyAssessment.result is SAFE");
  assert(
    assessment.overriddenAllergen === "peanuts",
    "SafetyAssessment.overriddenAllergen is 'peanuts'"
  );
  assert(
    assessment.correlationId === TEST_CORRELATION_ID,
    `SafetyAssessment.correlationId echoes the expected value (${TEST_CORRELATION_ID})`
  );

  // 5 — Query the audit row from the DB
  const rows = await db
    .select()
    .from(safetyOverrideAuditLogs)
    .where(eq(safetyOverrideAuditLogs.userId, testUserId))
    .orderBy(desc(safetyOverrideAuditLogs.createdAt))
    .limit(1);

  assert(rows.length === 1, "Exactly one audit row was written to safety_override_audit_logs");

  if (rows.length > 0) {
    const row = rows[0];

    // Track for cleanup
    cleanupAuditIds.push(row.id);

    assert(
      row.correlationId === TEST_CORRELATION_ID,
      `DB row correlation_id matches expected value (${TEST_CORRELATION_ID})`
    );
    assert(
      row.correlationId !== null && row.correlationId !== undefined && row.correlationId !== "",
      "DB row correlation_id is non-null and non-empty"
    );
    assert(
      row.allergenTriggered === "peanuts",
      "DB row allergen_triggered is 'peanuts'"
    );
    assert(
      row.safetyMode === "CUSTOM_AUTHENTICATED",
      "DB row safety_mode is CUSTOM_AUTHENTICATED"
    );
    assert(
      row.builderId === BUILDER_ID,
      `DB row builder_id is '${BUILDER_ID}'`
    );
    assert(
      row.userId === testUserId,
      "DB row user_id matches test user"
    );
  }
}

async function testAuditRowNotWrittenOnInvalidToken() {
  section("No audit row written when override token is invalid");

  // Reuse the same user (already created above) — no new allergy users needed
  if (!testUserId) {
    console.log("  ⚠️  Skipping — no test user available");
    return;
  }

  const beforeCount = (
    await db
      .select({ id: safetyOverrideAuditLogs.id })
      .from(safetyOverrideAuditLogs)
      .where(eq(safetyOverrideAuditLogs.userId, testUserId))
  ).length;

  // Pass a garbage token — should result in BLOCKED, not SAFE
  const assessment = await enforceSafetyProfile(
    testUserId,
    "peanut butter cookies",
    "craving-creator",
    {
      safetyMode: "CUSTOM_AUTHENTICATED",
      overrideToken: "invalid-token-that-does-not-exist",
      correlationId: "should-not-appear",
    }
  );

  assert(
    assessment.result === "BLOCKED",
    "SafetyAssessment.result is BLOCKED when token is invalid"
  );

  const afterCount = (
    await db
      .select({ id: safetyOverrideAuditLogs.id })
      .from(safetyOverrideAuditLogs)
      .where(eq(safetyOverrideAuditLogs.userId, testUserId))
  ).length;

  assert(
    afterCount === beforeCount,
    "No new audit row is inserted when the override token is invalid"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔒 Safety Override Audit Row — Integration Tests");
  console.log(`   DB: ${process.env.DATABASE_URL ? "configured" : "⚠️ DATABASE_URL missing"}\n`);

  try {
    await testAuditRowWrittenWithCorrelationId();
    await testAuditRowNotWrittenOnInvalidToken();
  } finally {
    await cleanup();
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failMessages.length > 0) {
    console.log("\nFailures:");
    failMessages.forEach((m) => console.log(m));
  }
  console.log("═".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  cleanup().finally(() => process.exit(1));
});
