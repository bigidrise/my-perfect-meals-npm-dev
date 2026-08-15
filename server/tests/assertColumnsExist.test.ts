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
 *   G. Unit — assertColumnsExist propagates DB connection errors (throws when db.execute rejects)
 *   H. Smoke — assertColumnsExist in prod.ts is not wrapped by withBootRetry so connection errors reach the fatal catch block
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

  it("F: prod.ts — the outer initializeApp catch calls process.exit(1) unconditionally for any boot error", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // Extract the outer catch block of initializeApp
    const catchMarker = "} catch (error) {\n    console.error(\"❌ [INIT] Initialization failed:\"";
    const catchIdx = src.indexOf(catchMarker);
    expect(catchIdx).toBeGreaterThan(-1);

    const catchBlock = src.slice(catchIdx, catchIdx + 800);

    // Must call process.exit(1)
    expect(catchBlock).toContain("process.exit(1)");

    // Must NOT be conditional on the error message prefix — DB connection errors
    // (ECONNREFUSED, SSL failure, etc.) don't start with "🚨 STARTUP GUARD:" but
    // must still be fatal so the server doesn't start in a degraded state.
    expect(catchBlock).not.toMatch(/if\s*\([^)]*startsWith[^)]*STARTUP GUARD/);
  });
});

// ---------------------------------------------------------------------------
// G — unit + integration: DB connection errors propagate out of assertColumnsExist
//     and trigger process.exit(1) via the prod.ts local catch pattern
// ---------------------------------------------------------------------------

describe("assertColumnsExist — DB connection error propagation", () => {
  it("G (integration): a DB connection error causes process.exit(1) via the prod.ts local catch pattern", async () => {
    // Spy on process.exit and make it throw so the async flow can be caught in
    // the test — without this Jest would actually exit.
    const exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation((() => {
        throw new Error("__process_exit_called__");
      }) as any);

    const connectionError = new Error("connect ECONNREFUSED 127.0.0.1:5432");
    const db = {
      execute: jest.fn().mockRejectedValue(connectionError),
    };

    // Mirror the exact pattern used in prod.ts around assertColumnsExist:
    // unconditional try/catch that calls process.exit(1) for any error.
    async function runWithProdBootPattern() {
      try {
        await assertColumnsExist(db as any, [
          { table: "users", column: "procare_training_completed" },
        ]);
      } catch (colGuardErr: any) {
        console.error(
          "🚨 [FATAL] Column guard failed — shutting down:",
          colGuardErr.message,
        );
        process.exit(1);
      }
    }

    // The spy throws, so the pattern rejects with our sentinel
    await expect(runWithProdBootPattern()).rejects.toThrow(
      "__process_exit_called__",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("G (integration): a missing-column error also causes process.exit(1) via the same local catch pattern", async () => {
    const exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation((() => {
        throw new Error("__process_exit_called__");
      }) as any);

    // DB returns empty rows — all columns appear missing
    const db = {
      execute: jest.fn().mockResolvedValue({ rows: [] }),
    };

    async function runWithProdBootPattern() {
      try {
        await assertColumnsExist(db as any, [
          {
            table: "users",
            column: "procare_training_completed",
            hint: "Phase 2 ProCare Studio gate",
          },
        ]);
      } catch (colGuardErr: any) {
        process.exit(1);
      }
    }

    await expect(runWithProdBootPattern()).rejects.toThrow(
      "__process_exit_called__",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("G: re-throws when db.execute rejects with a connection error", async () => {
    // Simulate the DB being completely unreachable — execute() rejects rather
    // than resolving with an empty result set.
    const connectionError = new Error(
      "connect ECONNREFUSED 127.0.0.1:5432",
    );
    const db = {
      execute: jest.fn().mockRejectedValue(connectionError),
    };

    await expect(
      assertColumnsExist(db as any, [
        { table: "users", column: "procare_training_completed" },
      ]),
    ).rejects.toThrow("connect ECONNREFUSED");
  });

  it("G: does not swallow the original error or replace it with a column-guard message", async () => {
    const connectionError = new Error("SSL connection terminated unexpectedly");
    const db = {
      execute: jest.fn().mockRejectedValue(connectionError),
    };

    let caught: Error | undefined;
    try {
      await assertColumnsExist(db as any, [
        { table: "users", column: "some_column" },
      ]);
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).toBeDefined();
    // Must be the original connection error, not a column-guard summary
    expect(caught!.message).not.toContain("🚨 STARTUP GUARD:");
    expect(caught!.message).toContain("SSL connection terminated");
  });
});

// ---------------------------------------------------------------------------
// H — smoke: assertColumnsExist in prod.ts has an explicit try/catch that
//            calls process.exit(1) for ALL errors (connection + missing column),
//            not just STARTUP GUARD messages
// ---------------------------------------------------------------------------

describe("prod.ts — assertColumnsExist has a local fatal guard (source inspection)", () => {
  const root = path.resolve(__dirname, "../..");

  /**
   * Helper: extract the source block that immediately wraps the
   * `await assertColumnsExist(` call, from the `try {` that opens it to the
   * closing `}` of its `catch` clause.
   */
  function extractAssertColumnsExistGuardBlock(src: string): string {
    // Find the `try {` that precedes `await assertColumnsExist(`
    const callIdx = src.indexOf("await assertColumnsExist(");
    expect(callIdx).toBeGreaterThan(-1);

    // Walk backward from the call to find the nearest `try {`
    const tryIdx = src.lastIndexOf("try {", callIdx);
    expect(tryIdx).toBeGreaterThan(-1);

    // Walk forward from the call past `]);` to find the closing `catch` block
    const catchIdx = src.indexOf("} catch (colGuardErr", callIdx);
    expect(catchIdx).toBeGreaterThan(callIdx);

    // Extend to the closing brace of the catch block (~600 chars is enough)
    return src.slice(tryIdx, catchIdx + 600);
  }

  it("H: the assertColumnsExist call is wrapped in a local try/catch, not left bare", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // Must have a `try {` before the call and a `catch (colGuardErr` after it
    const callIdx = src.indexOf("await assertColumnsExist(");
    expect(callIdx).toBeGreaterThan(-1);

    const tryIdx = src.lastIndexOf("try {", callIdx);
    expect(tryIdx).toBeGreaterThan(-1);

    const catchIdx = src.indexOf("} catch (colGuardErr", callIdx);
    expect(catchIdx).toBeGreaterThan(callIdx);
  });

  it("H: the local catch block calls process.exit(1) unconditionally (not gated on error message prefix)", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");
    const block = extractAssertColumnsExistGuardBlock(src);

    // process.exit(1) must be present in the catch block
    expect(block).toContain("process.exit(1)");

    // It must NOT be conditional on the STARTUP GUARD prefix — that would leave
    // DB connection errors unhandled
    expect(block).not.toMatch(/if\s*\(.*STARTUP GUARD.*\)\s*\{[^}]*process\.exit/s);
  });

  it("H: the local catch block does NOT silently discard the error — it logs before exiting", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");
    const block = extractAssertColumnsExistGuardBlock(src);

    // Must log the error before exiting so operators can see the root cause
    expect(block).toMatch(/console\.error/);

    // The log must reference the caught error variable
    expect(block).toContain("colGuardErr.message");
  });

  it("H: withBootRetry swallows errors after retries exhaust — confirming assertColumnsExist must not use it", () => {
    // withBootRetry is intentionally non-fatal for deferred migrations.
    // This test documents that invariant so a future refactor cannot accidentally
    // move assertColumnsExist inside withBootRetry and lose the fatal guarantee.
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    const defIdx = src.indexOf("async function withBootRetry(");
    expect(defIdx).toBeGreaterThan(-1);

    // Extract the function body (~700 chars covers all branches)
    const fnBody = src.slice(defIdx, defIdx + 700);

    // The exhausted branch logs but does NOT exit or rethrow
    expect(fnBody).toContain("console.error");
    expect(fnBody).not.toContain("process.exit");
    expect(fnBody).not.toMatch(/\bthrow\b/);
  });
});

// ---------------------------------------------------------------------------
// I — regression: both boot paths (index.ts + prod.ts) have matching
//     pre-flight ALTER statements for every column the guard asserts.
//     A column asserted without a preceding migration causes a fresh-DB crash.
// ---------------------------------------------------------------------------

describe("boot path parity — every asserted column has a pre-flight ALTER in both index.ts and prod.ts", () => {
  const root = path.resolve(__dirname, "../..");

  /**
   * Parse the column list passed to `assertColumnsExist(...)` from a source
   * string, returning Set of "table.column" strings.
   */
  function parseAssertedColumns(src: string): Set<string> {
    const start = src.indexOf("await assertColumnsExist(");
    expect(start).toBeGreaterThan(-1);

    // Find the closing `]);` that ends the columns array
    const end = src.indexOf("]);", start);
    expect(end).toBeGreaterThan(start);

    const block = src.slice(start, end);

    // Extract table/column pairs from object literals
    const tableRe = /table:\s*["']([^"']+)["']/g;
    const columnRe = /column:\s*["']([^"']+)["']/g;

    const tables: string[] = [];
    const columns: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tableRe.exec(block)) !== null) tables.push(m[1]);
    while ((m = columnRe.exec(block)) !== null) columns.push(m[1]);

    const result = new Set<string>();
    for (let i = 0; i < tables.length; i++) {
      result.add(`${tables[i]}.${columns[i]}`);
    }
    return result;
  }

  /**
   * Parse all `ALTER TABLE … ADD COLUMN IF NOT EXISTS` targets from a source
   * string's pre-flight block, returning Set of "table.column" strings.
   */
  function parsePreflightColumns(src: string): Set<string> {
    const start = src.indexOf("Critical column pre-flight migrations");
    expect(start).toBeGreaterThan(-1);

    // The pre-flight block ends at the closing `});` of the withBootRetry call
    const end = src.indexOf("});", start);
    expect(end).toBeGreaterThan(start);

    const block = src.slice(start, end);

    const re =
      /ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/g;
    const result = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      result.add(`${m[1]}.${m[2]}`);
    }
    return result;
  }

  it("I (index.ts): every column asserted by the guard is pre-migrated in the preflight block", () => {
    const src = fs.readFileSync(path.join(root, "server/index.ts"), "utf8");

    const asserted = parseAssertedColumns(src);
    const preflight = parsePreflightColumns(src);

    const missing = [...asserted].filter((col) => !preflight.has(col));
    expect(missing).toEqual(
      [],
      // Custom message: list the columns that need a preflight ALTER in index.ts
    );
  });

  it("I (prod.ts): every column asserted by the guard is pre-migrated in the preflight block", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    const asserted = parseAssertedColumns(src);
    const preflight = parsePreflightColumns(src);

    const missing = [...asserted].filter((col) => !preflight.has(col));
    expect(missing).toEqual([]);
  });

  it("I: both boot paths assert the same set of critical columns (no drift between index.ts and prod.ts)", () => {
    const indexSrc = fs.readFileSync(path.join(root, "server/index.ts"), "utf8");
    const prodSrc = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    const indexAsserted = parseAssertedColumns(indexSrc);
    const prodAsserted = parseAssertedColumns(prodSrc);

    const onlyInIndex = [...indexAsserted].filter((c) => !prodAsserted.has(c));
    const onlyInProd = [...prodAsserted].filter((c) => !indexAsserted.has(c));

    expect(onlyInIndex).toEqual([]);
    expect(onlyInProd).toEqual([]);
  });
});
