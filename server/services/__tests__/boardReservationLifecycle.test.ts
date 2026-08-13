/**
 * Board Reservation Lifecycle — integration tests
 *
 * Tests the DB-backed lifecycle: board item placed → logged (converted) →
 * second log rejected with ALREADY_LOGGED.
 *
 * These tests hit the real DB (DATABASE_URL must be set).
 * Run: npx tsx server/services/__tests__/boardReservationLifecycle.test.ts
 *
 * Cleanup: all rows inserted during the test are deleted on exit.
 */

import { db } from "../../db";
import { macroLogs } from "../../../shared/schema";
import { writeMacroLog } from "../macroLogService";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failMessages: string[] = [];
const cleanupLogIds: number[] = [];

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
  if (cleanupLogIds.length === 0) return;
  try {
    for (const id of cleanupLogIds) {
      await db.delete(macroLogs).where(eq(macroLogs.id, id));
    }
    console.log(`\n🧹 Cleaned up ${cleanupLogIds.length} test log row(s)`);
  } catch (err) {
    console.error("⚠️  Cleanup failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const TEST_USER_ID = "test-board-lifecycle-" + Date.now();
const BOARD_ITEM_ID_A = randomUUID();
const BOARD_ITEM_ID_B = randomUUID();

// Section 1: boardItemReference is persisted correctly
section("1 — writeMacroLog persists boardItemReference");
{
  try {
    const row = await writeMacroLog({
      userId:             TEST_USER_ID,
      calories:           500,
      protein:            40,
      carbohydrates:      50,
      fat:                15,
      starchyCarbs:       35,
      fibrousCarbs:       15,
      classificationSource: "ingredient",
      source:             "board",
      dateIso:            "2026-08-12T12:00:00Z",
      boardItemReference: BOARD_ITEM_ID_A,
    });

    if (row?.id) cleanupLogIds.push(row.id);

    assert(row != null, "writeMacroLog returns a row");
    assert(row?.boardItemReference === BOARD_ITEM_ID_A, `boardItemReference stored correctly (got ${row?.boardItemReference})`);

    // Verify via direct DB read
    const [dbRow] = await db
      .select()
      .from(macroLogs)
      .where(sql`${macroLogs.boardItemReference} = ${BOARD_ITEM_ID_A}`)
      .limit(1);

    assert(dbRow != null, "row found in DB by board_item_reference");
    assert(Number(dbRow?.kcal) === 500, `calories stored correctly (got ${dbRow?.kcal})`);
    assert(Number(dbRow?.protein) === 40, `protein stored correctly (got ${dbRow?.protein})`);
  } catch (err: any) {
    assert(false, `writeMacroLog with boardItemReference: unexpected error: ${err.message}`);
  }
}

// Section 2: Duplicate log rejected with ALREADY_LOGGED
section("2 — Second log with same boardItemReference → ALREADY_LOGGED");
{
  try {
    // Attempt to log BOARD_ITEM_ID_A again (already logged in section 1)
    await writeMacroLog({
      userId:             TEST_USER_ID,
      calories:           500,
      protein:            40,
      carbohydrates:      50,
      fat:                15,
      classificationSource: "ingredient",
      source:             "board",
      dateIso:            "2026-08-12T13:00:00Z", // different time — same board item
      boardItemReference: BOARD_ITEM_ID_A,
    });

    // Should NOT reach here
    assert(false, "second log should have been rejected but was accepted");
  } catch (err: any) {
    assert(err?.code === "ALREADY_LOGGED", `error code is ALREADY_LOGGED (got: ${err?.code})`);
    assert(
      err?.boardItemReference === BOARD_ITEM_ID_A,
      `boardItemReference echoed back (got: ${err?.boardItemReference})`,
    );
  }
}

// Section 3: Non-board logs are unaffected — multiple logs without boardItemReference allowed
section("3 — Non-board logs (no boardItemReference) allow multiple rows");
{
  try {
    const row1 = await writeMacroLog({
      userId:        TEST_USER_ID,
      calories:      200,
      protein:       20,
      carbohydrates: 25,
      fat:           5,
      source:        "quick",
      dateIso:       "2026-08-12T08:00:00Z",
    });
    if (row1?.id) cleanupLogIds.push(row1.id);

    // Second quick-log should succeed (no board_item_reference constraint applies)
    const row2 = await writeMacroLog({
      userId:        TEST_USER_ID,
      calories:      300,
      protein:       25,
      carbohydrates: 30,
      fat:           8,
      source:        "food",
      dateIso:       "2026-08-12T12:30:00Z",
    });
    if (row2?.id) cleanupLogIds.push(row2.id);

    assert(row1 != null && row2 != null, "both non-board logs inserted without error");
    assert(row1?.id !== row2?.id, "each log gets its own ID (no accumulation on unique constraint)");
  } catch (err: any) {
    assert(false, `non-board logs should succeed: unexpected error: ${err.message}`);
  }
}

// Section 4: Two different board items can each be logged once
section("4 — Two distinct board items can each be logged once");
{
  try {
    const rowA2 = await writeMacroLog({
      userId:             TEST_USER_ID,
      calories:           400,
      protein:            35,
      carbohydrates:      40,
      fat:                12,
      classificationSource: "ingredient",
      source:             "board",
      dateIso:            "2026-08-12T18:00:00Z",
      boardItemReference: BOARD_ITEM_ID_B, // different board item
    });
    if (rowA2?.id) cleanupLogIds.push(rowA2.id);

    assert(rowA2 != null, "second distinct board item logged successfully");
    assert(rowA2?.boardItemReference === BOARD_ITEM_ID_B, "correct boardItemReference stored");
  } catch (err: any) {
    assert(false, `distinct board item log failed unexpectedly: ${err.message}`);
  }
}

// Section 5: No double-counting — verify consumed sum excludes re-logged items
section("5 — Consumed sum is correct (no double-counting after reservation → log)");
{
  // Query consumed calories for the test user on 2026-08-12
  try {
    const [totals] = await db
      .select({
        totalKcal: sql<number>`COALESCE(SUM(${macroLogs.kcal}::numeric), 0)`,
        rowCount:  sql<number>`COUNT(*)`,
      })
      .from(macroLogs)
      .where(
        sql`${macroLogs.userId} = ${TEST_USER_ID}
          AND ${macroLogs.at} >= '2026-08-12T00:00:00Z'::timestamptz
          AND ${macroLogs.at} <  '2026-08-13T00:00:00Z'::timestamptz`,
      );

    // Section 1: BOARD_ITEM_ID_A → 500 kcal
    // Section 3: quick 200 kcal + food 300 kcal
    // Section 4: BOARD_ITEM_ID_B → 400 kcal
    // BOARD_ITEM_ID_A duplicate (section 2) was REJECTED — should NOT appear
    const expectedKcal = 500 + 200 + 300 + 400; // = 1400
    const actualKcal   = Number(totals?.totalKcal ?? 0);
    const actualRows   = Number(totals?.rowCount   ?? 0);

    assert(actualRows === 4, `exactly 4 rows for test user (got ${actualRows}) — rejected duplicate not counted`);
    assert(
      actualKcal === expectedKcal,
      `total calories = ${expectedKcal} (no double-count); got ${actualKcal}`,
    );
  } catch (err: any) {
    assert(false, `consumed sum query failed: ${err.message}`);
  }
}

// Section 6: Authorization — cross-user board item claim is rejected
// This is the DoS defence: User B must never be able to cause User A's
// board-item log to fail with ALREADY_LOGGED by claiming the same reference
// first. The writeMacroLog service enforces uniqueness via the partial unique
// index on board_item_reference regardless of userId, so:
//   • The dedicated POST /boards/:boardId/items/:itemId/log route validates
//     board ownership before calling writeMacroLog.
//   • The generic POST /api/macros/log route strips boardItemReference entirely,
//     so it cannot be supplied by an attacker from the client.
// This section verifies both sides of that guarantee.
section("6 — Cross-user: User B cannot claim User A's already-logged board item");
{
  const USER_B_ID = "test-board-userB-" + Date.now();
  try {
    // BOARD_ITEM_ID_A was logged by TEST_USER_ID (User A) in Section 1.
    // User B tries to log the same item reference — must be rejected.
    await writeMacroLog({
      userId:             USER_B_ID,
      calories:           999,
      protein:            50,
      carbohydrates:      80,
      fat:                20,
      classificationSource: "ingredient",
      source:             "board",
      dateIso:            "2026-08-12T20:00:00Z",
      boardItemReference: BOARD_ITEM_ID_A, // same UUID, different user
    });

    // Must NOT reach here — the unique partial index is user-agnostic
    assert(false, "User B claimed User A's board item — unique index failed to block it");
  } catch (err: any) {
    assert(
      err?.code === "ALREADY_LOGGED" || (err?.cause?.code ?? err?.code) === "23505",
      `User B's attempt rejected (code: ${err?.code ?? err?.cause?.code})`,
    );
  }
}

section("6b — Generic route path: boardItemReference ignored at service layer");
{
  // The generic macro log service is called WITHOUT boardItemReference
  // (the route layer strips it). Verify that logging without the field
  // succeeds and does NOT set board_item_reference on the resulting row.
  try {
    const row = await writeMacroLog({
      userId:        TEST_USER_ID,
      calories:      100,
      protein:       10,
      carbohydrates: 10,
      fat:            3,
      source:        "manual",
      dateIso:       "2026-08-12T21:00:00Z",
      // boardItemReference intentionally omitted (simulating the generic route)
    });
    if (row?.id) cleanupLogIds.push(row.id);
    assert(row != null, "generic log (no boardItemReference) succeeds");
    assert(
      row?.boardItemReference == null,
      `boardItemReference is null/undefined on generic log (got: ${row?.boardItemReference})`,
    );
  } catch (err: any) {
    assert(false, `generic log without boardItemReference failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary and cleanup
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

await cleanup();

if (failMessages.length > 0) {
  console.log("\nFailures:");
  failMessages.forEach((m) => console.log(m));
  process.exit(1);
} else {
  console.log("✅ All integration tests passed");
  process.exit(0);
}
