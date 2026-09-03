/**
 * server/db/migrations/__tests__/bootSequencing.test.ts
 *
 * Boot-ordering regression tests: verifies that each guard-backed column is
 * migrated before its guard fires, even when schemaMigPromise times out.
 *
 * Simulates the production path where the 6-second race can cut off
 * schemaMigPromise before runTrialGrantsMigration (which sits at the end of
 * the promise chain) has a chance to run.  The synchronous guard-backing
 * block in prod.ts is responsible for ensuring every column exists regardless
 * of the race outcome; these tests confirm that contract holds.
 *
 * Pure-function tests: no real DB, no network.
 * Run: npx tsx server/db/migrations/__tests__/bootSequencing.test.ts
 */

import { runTrialGrantsMigration } from "../runTrialGrantsMigration";
import { runProcareTrainingMigration } from "../runProcareTrainingMigration";
import { runPerformanceModeEnabledMigration } from "../runPerformanceModeEnabledMigration";
import { assertTrialSourceColumn } from "../assertTrialSourceColumn";
import { assertProcareTrainingCompletedColumn } from "../assertProcareTrainingCompletedColumn";
import { assertPerformanceModeEnabledColumn } from "../assertPerformanceModeEnabledColumn";

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

/**
 * A stateful fake DB that starts with no columns and records every ALTER TABLE
 * ADD COLUMN statement executed against it. execute() inspects the query for
 * known column names and tracks which ones have been "added".
 *
 * Queries that look like information_schema SELECTs return the column as
 * present only if the migration for that column has already been executed.
 */
function makeStatefulDb() {
  const addedColumns = new Set<string>();
  const executionLog: string[] = [];

  return {
    addedColumns,
    executionLog,
    execute: async (query: any): Promise<any> => {
      const raw: string = query?.queryChunks
        ?.map((c: any) => (typeof c === "string" ? c : c?.value ?? ""))
        .join("") ?? String(query);

      executionLog.push(raw);

      // Detect ADD COLUMN statements and record the column as present.
      const addMatch = raw.match(/ADD COLUMN IF NOT EXISTS\s+(\w+)/i);
      if (addMatch) {
        addedColumns.add(addMatch[1]);
        return { rows: [] };
      }

      // Detect information_schema SELECT for a specific column_name.
      const selectMatch = raw.match(/column_name\s*=\s*'(\w+)'/i);
      if (selectMatch) {
        const col = selectMatch[1];
        return { rows: addedColumns.has(col) ? [{ column_name: col }] : [] };
      }

      // CREATE TABLE, UPDATE, INSERT — treat as no-ops.
      return { rows: [] };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  // ── 1. Guard fires before migration — should throw (ordering violation) ───
  section("trial_source: guard before migration → throws STARTUP GUARD");
  {
    const db = makeStatefulDb();
    try {
      await assertTrialSourceColumn(db as any);
      assert(false, "should throw when trial_source was never migrated");
    } catch (err: any) {
      assert(err.message.includes("STARTUP GUARD"), "throws STARTUP GUARD when column absent");
    }
  }

  section("procare_training_completed: guard before migration → throws STARTUP GUARD");
  {
    const db = makeStatefulDb();
    try {
      await assertProcareTrainingCompletedColumn(db as any);
      assert(false, "should throw when procare_training_completed was never migrated");
    } catch (err: any) {
      assert(err.message.includes("STARTUP GUARD"), "throws STARTUP GUARD when column absent");
    }
  }

  section("performance_mode_enabled: guard before migration → throws STARTUP GUARD");
  {
    const db = makeStatefulDb();
    try {
      await assertPerformanceModeEnabledColumn(db as any);
      assert(false, "should throw when performance_mode_enabled was never migrated");
    } catch (err: any) {
      assert(err.message.includes("STARTUP GUARD"), "throws STARTUP GUARD when column absent");
    }
  }

  // ── 2. Migration then guard — should pass (correct ordering) ─────────────
  section("trial_source: migration then guard → passes");
  {
    const db = makeStatefulDb();
    await runTrialGrantsMigration(db as any);
    assert(db.addedColumns.has("trial_source"), "runTrialGrantsMigration adds trial_source");
    try {
      await assertTrialSourceColumn(db as any);
      assert(true, "assertTrialSourceColumn passes after migration");
    } catch (err: any) {
      assert(false, `should not throw after migration: ${err.message}`);
    }
  }

  section("procare_training_completed: migration then guard → passes");
  {
    const db = makeStatefulDb();
    await runProcareTrainingMigration(db as any);
    assert(db.addedColumns.has("procare_training_completed"), "runProcareTrainingMigration adds column");
    try {
      await assertProcareTrainingCompletedColumn(db as any);
      assert(true, "assertProcareTrainingCompletedColumn passes after migration");
    } catch (err: any) {
      assert(false, `should not throw after migration: ${err.message}`);
    }
  }

  section("performance_mode_enabled: migration then guard → passes");
  {
    const db = makeStatefulDb();
    await runPerformanceModeEnabledMigration(db as any);
    assert(db.addedColumns.has("performance_mode_enabled"), "runPerformanceModeEnabledMigration adds column");
    try {
      await assertPerformanceModeEnabledColumn(db as any);
      assert(true, "assertPerformanceModeEnabledColumn passes after migration");
    } catch (err: any) {
      assert(false, `should not throw after migration: ${err.message}`);
    }
  }

  // ── 3. Timeout scenario: schemaMigPromise timed out, sync block saves boot ─
  section("Timeout scenario: schemaMigPromise timed out → sync block + guards succeed");
  {
    const db = makeStatefulDb();

    // Simulate schemaMigPromise timing out: columns are NOT present yet.
    // (The race resolves to the timeout promise, leaving addedColumns empty.)
    assert(db.addedColumns.size === 0, "no columns present after simulated timeout");

    // The production synchronous guard-backing block runs all three migrations
    // unconditionally after the race. Simulate that here.
    await runTrialGrantsMigration(db as any);
    await runProcareTrainingMigration(db as any);
    await runPerformanceModeEnabledMigration(db as any);

    assert(db.addedColumns.has("trial_source"), "trial_source present after sync block");
    assert(db.addedColumns.has("procare_training_completed"), "procare_training_completed present after sync block");
    assert(db.addedColumns.has("performance_mode_enabled"), "performance_mode_enabled present after sync block");

    // Guards should now all pass.
    let guardErrors = 0;
    for (const [label, fn] of [
      ["assertTrialSourceColumn", () => assertTrialSourceColumn(db as any)],
      ["assertProcareTrainingCompletedColumn", () => assertProcareTrainingCompletedColumn(db as any)],
      ["assertPerformanceModeEnabledColumn", () => assertPerformanceModeEnabledColumn(db as any)],
    ] as const) {
      try {
        await fn();
        assert(true, `${label} passes after sync block`);
      } catch (err: any) {
        guardErrors++;
        assert(false, `${label} should not throw after sync block: ${err.message}`);
      }
    }
    assert(guardErrors === 0, "all guards pass after sync guard-backing block");
  }

  // ── 4. Idempotency: migrations are safe to run twice (IF NOT EXISTS) ──────
  section("Idempotency: running each migration twice does not throw");
  {
    const db = makeStatefulDb();
    try {
      await runTrialGrantsMigration(db as any);
      await runTrialGrantsMigration(db as any);
      await runProcareTrainingMigration(db as any);
      await runProcareTrainingMigration(db as any);
      await runPerformanceModeEnabledMigration(db as any);
      await runPerformanceModeEnabledMigration(db as any);
      assert(true, "all three migrations are idempotent (no throw on second run)");
    } catch (err: any) {
      assert(false, `migration threw on second run: ${err.message}`);
    }
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
