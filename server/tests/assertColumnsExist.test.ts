/**
 * assertColumnsExist.test.ts
 *
 * Tests:
 *   A. Unit — helper correctly detects missing columns and includes hints
 *   B. Unit — helper resolves when all columns are present
 *   C. Unit — helper is a no-op for an empty descriptor list
 *   D. Unit — all missing columns appear in a single thrown error
 *   E. Smoke — index.ts propagates column guard errors to process.exit
 *   F. Smoke — prod.ts does not silently discard column guard errors
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { assertColumnsExist } from "../../server/bootstrap/assertColumnsExist";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal drizzle-like DB mock that returns the given rows. */
function mockDb(rows: Array<{ table_name: string; column_name: string }>) {
  return {
    execute: jest.fn().mockResolvedValue({ rows }),
  };
}

// ---------------------------------------------------------------------------
// A + B + C + D — unit tests for assertColumnsExist
// ---------------------------------------------------------------------------

describe("assertColumnsExist — unit", () => {
  it("A: resolves when all requested columns are present", async () => {
    const db = mockDb([
      { table_name: "users", column_name: "procare_training_completed" },
      { table_name: "saved_meals", column_name: "saved_from_diabetic_builder" },
    ]);

    await expect(
      assertColumnsExist(db as any, [
        { table: "users", column: "procare_training_completed" },
        { table: "saved_meals", column: "saved_from_diabetic_builder" },
      ]),
    ).resolves.toBeUndefined();
  });

  it("C: is a no-op (no DB query) when the descriptor list is empty", async () => {
    const db = mockDb([]);
    await expect(assertColumnsExist(db as any, [])).resolves.toBeUndefined();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("A: throws when a single column is missing", async () => {
    const db = mockDb([
      // users.procare_training_completed is present; saved_meals column is absent
      { table_name: "users", column_name: "procare_training_completed" },
    ]);

    await expect(
      assertColumnsExist(db as any, [
        { table: "users", column: "procare_training_completed" },
        {
          table: "saved_meals",
          column: "saved_from_diabetic_builder",
          hint: "Diabetic builder save flow — meal saves will 500 if this column is absent",
        },
      ]),
    ).rejects.toThrow("saved_meals.saved_from_diabetic_builder");
  });

  it("A: includes the hint text in the thrown error message", async () => {
    const db = mockDb([]); // nothing present

    let err: Error | undefined;
    try {
      await assertColumnsExist(db as any, [
        {
          table: "users",
          column: "preferred_language",
          hint: "i18n routing — missing column falls back to English for all users silently",
        },
      ]);
    } catch (e) {
      err = e as Error;
    }

    expect(err).toBeDefined();
    expect(err!.message).toContain("users.preferred_language");
    expect(err!.message).toContain(
      "i18n routing — missing column falls back to English for all users silently",
    );
    expect(err!.message).toContain("🚨 STARTUP GUARD:");
  });

  it("D: lists every missing column in a single error when multiple are absent", async () => {
    const db = mockDb([]); // all absent

    let err: Error | undefined;
    try {
      await assertColumnsExist(db as any, [
        { table: "users", column: "col_a", hint: "hint for col_a" },
        { table: "users", column: "col_b", hint: "hint for col_b" },
        { table: "logs", column: "col_c" }, // no hint
      ]);
    } catch (e) {
      err = e as Error;
    }

    expect(err).toBeDefined();
    expect(err!.message).toContain("3 critical column(s) are missing");
    expect(err!.message).toContain("users.col_a");
    expect(err!.message).toContain("hint for col_a");
    expect(err!.message).toContain("users.col_b");
    expect(err!.message).toContain("hint for col_b");
    expect(err!.message).toContain("logs.col_c");
  });

  it("A: does not throw when DB returns results as a plain array (no .rows wrapper)", async () => {
    // Some drizzle adapters return the array directly rather than { rows: [...] }
    const db = {
      execute: jest.fn().mockResolvedValue([
        { table_name: "users", column_name: "performance_mode_enabled" },
      ]),
    };

    await expect(
      assertColumnsExist(db as any, [
        { table: "users", column: "performance_mode_enabled" },
      ]),
    ).resolves.toBeUndefined();
  });

  it("A: error message does not contain any hint when no hint is provided", async () => {
    const db = mockDb([]);

    let err: Error | undefined;
    try {
      await assertColumnsExist(db as any, [
        { table: "users", column: "no_hint_column" },
      ]);
    } catch (e) {
      err = e as Error;
    }

    expect(err).toBeDefined();
    expect(err!.message).toContain("users.no_hint_column");
    // The bullet line should not contain " — " (the hint separator) when hint is absent
    const bulletLine = err!.message
      .split("\n")
      .find((l) => l.includes("users.no_hint_column"))!;
    expect(bulletLine).not.toMatch(/ — .+/);
  });
});

// ---------------------------------------------------------------------------
// E + F — smoke tests: error propagation in boot sequences
// ---------------------------------------------------------------------------

describe("boot sequence — column guard error propagation (smoke)", () => {
  const root = path.resolve(__dirname, "../..");

  it("E: index.ts — start() errors reach process.exit via the .catch() handler", () => {
    const src = fs.readFileSync(path.join(root, "server/index.ts"), "utf8");

    // The top-level call must be start().catch(...) and the handler must call
    // process.exit so a thrown assertColumnsExist error kills the process.
    expect(src).toMatch(/start\(\)\s*\.catch\s*\(/);

    // Locate the .catch block after start()
    const catchIdx = src.lastIndexOf("start().catch");
    const catchBlock = src.slice(catchIdx, catchIdx + 200);
    expect(catchBlock).toContain("process.exit");
  });

  it("F: prod.ts — STARTUP GUARD errors are not silently discarded; process.exit is called", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // The catch block inside initializeApp must explicitly handle STARTUP GUARD
    // messages by calling process.exit so a column-guard failure is fatal.
    expect(src).toMatch(/STARTUP GUARD/);
    expect(src).toMatch(/process\.exit\s*\(\s*1\s*\)/);

    // Both must appear in the same catch block — verify they are close together
    const startupGuardIdx = src.indexOf("STARTUP GUARD:");
    expect(startupGuardIdx).toBeGreaterThan(-1);

    // Find the nearest process.exit(1) after the STARTUP GUARD check
    const exitIdx = src.indexOf("process.exit(1)", startupGuardIdx);
    expect(exitIdx).toBeGreaterThan(-1);

    // They should be within 300 characters of each other (same if-block)
    expect(exitIdx - startupGuardIdx).toBeLessThan(300);
  });

  it("F: prod.ts — the initializeApp catch block re-throws or exits for STARTUP GUARD, not just logs", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // Extract the catch block at the end of initializeApp
    const catchMarker = "} catch (error) {\n    console.error(\"❌ [INIT] Initialization failed:\"";
    const catchIdx = src.indexOf(catchMarker);
    expect(catchIdx).toBeGreaterThan(-1);

    // The block must not end without a process.exit guard for STARTUP GUARD errors
    const catchBlock = src.slice(catchIdx, catchIdx + 700);
    expect(catchBlock).toContain("STARTUP GUARD");
    expect(catchBlock).toContain("process.exit(1)");
  });
});
