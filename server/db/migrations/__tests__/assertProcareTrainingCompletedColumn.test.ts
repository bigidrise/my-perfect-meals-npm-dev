/**
 * server/db/migrations/__tests__/assertProcareTrainingCompletedColumn.test.ts
 *
 * Unit tests for the procare_training_completed startup guard.
 *
 * Verifies that assertProcareTrainingCompletedColumn() throws a descriptive
 * error (containing "STARTUP GUARD" and "procare_training_completed") when the
 * DB query returns zero rows — i.e., when the column is genuinely absent.
 *
 * Also confirms the function resolves cleanly when the column exists.
 *
 * Pure-function tests: no real DB, no network.
 * Run: npx tsx server/db/migrations/__tests__/assertProcareTrainingCompletedColumn.test.ts
 */

import { assertProcareTrainingCompletedColumn } from "../assertProcareTrainingCompletedColumn";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test harness (matches project convention)
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failMessages.push(label);
    console.log(`  ❌ ${label}`);
  }
}

function section(name: string) {
  console.log(`\n── ${name}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fake DB helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a mock db whose execute() resolves to the supplied rows shape. */
function fakeDb(rows: unknown[]) {
  return {
    execute: async (_query: unknown) => ({ rows }),
  };
}

/** Returns a mock db whose execute() resolves to the rows directly (no .rows
 *  wrapper) — tests the alternate branch `(guardResult as any).rows ?? guardResult`. */
function fakeDbDirect(rows: unknown[]) {
  return {
    execute: async (_query: unknown) => rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  // ── 1. Column absent — .rows wrapper ─────────────────────────────────────
  section("Column absent — DB returns empty rows array (.rows wrapper)");
  try {
    await assertProcareTrainingCompletedColumn(fakeDb([]) as any);
    assert(false, "should have thrown when rows is empty");
  } catch (err: any) {
    assert(err instanceof Error, "throws an Error instance");
    assert(
      err.message.includes("STARTUP GUARD"),
      'error message contains "STARTUP GUARD"',
    );
    assert(
      err.message.includes("procare_training_completed"),
      'error message contains "procare_training_completed"',
    );
  }

  // ── 2. Column absent — direct array result (no .rows wrapper) ────────────
  section("Column absent — DB returns empty direct array (no .rows wrapper)");
  try {
    await assertProcareTrainingCompletedColumn(fakeDbDirect([]) as any);
    assert(false, "should have thrown when result array is empty");
  } catch (err: any) {
    assert(err instanceof Error, "throws an Error instance");
    assert(
      err.message.includes("STARTUP GUARD"),
      'error message contains "STARTUP GUARD"',
    );
    assert(
      err.message.includes("procare_training_completed"),
      'error message contains "procare_training_completed"',
    );
  }

  // ── 3. Column present — .rows wrapper ────────────────────────────────────
  section("Column present — DB returns one row (.rows wrapper)");
  try {
    await assertProcareTrainingCompletedColumn(
      fakeDb([{ column_name: "procare_training_completed" }]) as any,
    );
    assert(true, "resolves without throwing when column exists");
  } catch (err: any) {
    assert(false, `should not throw when column exists: ${err.message}`);
  }

  // ── 4. Column present — direct array result ───────────────────────────────
  section("Column present — DB returns one-element direct array");
  try {
    await assertProcareTrainingCompletedColumn(
      fakeDbDirect([{ column_name: "procare_training_completed" }]) as any,
    );
    assert(true, "resolves without throwing when column exists (direct array)");
  } catch (err: any) {
    assert(false, `should not throw when column exists: ${err.message}`);
  }

  // ── 5. Non-array result (edge case) ──────────────────────────────────────
  section("Non-array result (malformed DB response)");
  try {
    const brokenDb = {
      execute: async (_query: unknown) => ({ rows: null }),
    };
    await assertProcareTrainingCompletedColumn(brokenDb as any);
    assert(false, "should have thrown when rows is null");
  } catch (err: any) {
    assert(err instanceof Error, "throws an Error instance");
    assert(
      err.message.includes("STARTUP GUARD"),
      'error message contains "STARTUP GUARD"',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failMessages.length > 0) {
    console.log("Failed:");
    failMessages.forEach((m) => console.log(`  ✗ ${m}`));
    process.exit(1);
  } else {
    console.log("All tests passed ✅");
  }
}

runTests().catch((err) => {
  console.error("Unexpected test runner error:", err);
  process.exit(1);
});
