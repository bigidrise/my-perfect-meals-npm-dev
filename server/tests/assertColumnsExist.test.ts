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
 *   G. Smoke — both entry points reference CRITICAL_COLUMNS, not inline arrays
 *   H. Coverage — every CRITICAL_COLUMNS entry has a preflight migration in both entry points
 *   I. Sequencing — prod.ts CRITICAL_COLUMNS preflight and guard run before registerRoutes
 *   J. Unit — assertColumnsExist propagates DB connection errors (throws when db.execute rejects)
 *   K. Smoke — assertColumnsExist in prod.ts is not wrapped by withBootRetry so connection errors reach the fatal catch block
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
// G — sync guard: both entry points must reference the shared CRITICAL_COLUMNS
// ---------------------------------------------------------------------------

describe("CRITICAL_COLUMNS sync guard", () => {
  const root = path.resolve(__dirname, "../..");

  it("G: assertColumnsExist.ts exports a non-empty CRITICAL_COLUMNS array", async () => {
    const { CRITICAL_COLUMNS } = await import("../../server/bootstrap/assertColumnsExist");
    expect(Array.isArray(CRITICAL_COLUMNS)).toBe(true);
    expect(CRITICAL_COLUMNS.length).toBeGreaterThan(0);
    // Every descriptor must have table and column
    for (const descriptor of CRITICAL_COLUMNS) {
      expect(typeof descriptor.table).toBe("string");
      expect(descriptor.table.length).toBeGreaterThan(0);
      expect(typeof descriptor.column).toBe("string");
      expect(descriptor.column.length).toBeGreaterThan(0);
    }
  });

  it("G: index.ts uses CRITICAL_COLUMNS from the shared module, not an inline array", () => {
    const src = fs.readFileSync(path.join(root, "server/index.ts"), "utf8");
    // Must import CRITICAL_COLUMNS
    expect(src).toMatch(/CRITICAL_COLUMNS/);
    // Must call assertColumnsExist with CRITICAL_COLUMNS (not an inline array literal)
    expect(src).toMatch(/assertColumnsExist\s*\(\s*\w+\s*,\s*CRITICAL_COLUMNS\s*\)/);
  });

  it("G: prod.ts uses CRITICAL_COLUMNS from the shared module, not an inline array", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");
    // Must import CRITICAL_COLUMNS
    expect(src).toMatch(/CRITICAL_COLUMNS/);
    // Must call assertColumnsExist with CRITICAL_COLUMNS (not an inline array literal)
    expect(src).toMatch(/assertColumnsExist\s*\(\s*\w+\s*,\s*CRITICAL_COLUMNS\s*\)/);
  });

  it("G: neither index.ts nor prod.ts contain an inline ColumnDescriptor array for the column guard", () => {
    const indexSrc = fs.readFileSync(path.join(root, "server/index.ts"), "utf8");
    const prodSrc = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // If either file contains a hardcoded column guard array it will have a
    // "table:" key inside the assertColumnsExist call block.  We detect this by
    // checking for the pattern that used to be there: passing an array literal
    // directly to assertColumnsExist.
    const inlineArrayPattern = /assertColumnsExist\s*\([^)]*table\s*:/s;
    expect(indexSrc).not.toMatch(inlineArrayPattern);
    expect(prodSrc).not.toMatch(inlineArrayPattern);
  });
});

// ---------------------------------------------------------------------------
// H — coverage: every CRITICAL_COLUMNS entry must have a preflight migration
// in both entry points so the guard never races its own migration
// ---------------------------------------------------------------------------

describe("CRITICAL_COLUMNS preflight migration coverage", () => {
  const root = path.resolve(__dirname, "../..");

  // ── index.ts: uses a single withBootRetry block ──────────────────────────

  /**
   * Extracts the text of the withBootRetry("Critical column pre-flight
   * migrations", ...) call block in index.ts.
   */
  function extractIndexPreflightBlock(src: string): string {
    const marker = 'withBootRetry("Critical column pre-flight migrations"';
    const start = src.indexOf(marker);
    if (start === -1) {
      throw new Error(
        `Could not find withBootRetry("Critical column pre-flight migrations" in server/index.ts`,
      );
    }
    let depth = 0;
    let i = src.indexOf("{", start);
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    return src.slice(start, i + 1);
  }

  // ── prod.ts: uses the early pre-route preflight block ────────────────────

  /**
   * Extracts the text of the early CRITICAL_COLUMNS pre-route preflight block
   * in prod.ts (the awaited block before `registerRoutes`, keyed by its unique
   * marker comment).  This is the block that must cover every descriptor — the
   * deferred withBootRetry block that follows is belt-and-suspenders only.
   */
  function extractProdEarlyPreflightBlock(src: string): string {
    const marker =
      "CRITICAL_COLUMNS pre-route preflight — all entries awaited before routes mount";
    const start = src.indexOf(marker);
    if (start === -1) {
      throw new Error(
        `Could not find CRITICAL_COLUMNS pre-route preflight marker in server/prod.ts`,
      );
    }
    // Capture up to (but not including) the first `registerRoutes` after it
    const registerIdx = src.indexOf("await registerRoutes(app)", start);
    if (registerIdx === -1) {
      throw new Error(
        `Could not find await registerRoutes(app) after preflight marker in server/prod.ts`,
      );
    }
    return src.slice(start, registerIdx);
  }

  it("H: index.ts preflight block covers every CRITICAL_COLUMNS entry", async () => {
    const { CRITICAL_COLUMNS } = await import(
      "../../server/bootstrap/assertColumnsExist"
    );
    const src = fs.readFileSync(path.join(root, "server/index.ts"), "utf8");
    const block = extractIndexPreflightBlock(src);

    const missing: string[] = [];
    for (const descriptor of CRITICAL_COLUMNS) {
      // Each guarded column must have an ADD COLUMN IF NOT EXISTS statement
      // in the preflight block. We check for both the table and column name
      // appearing together in the same block.
      const tableOk = block.includes(descriptor.table);
      const colOk = block.includes(descriptor.column);
      if (!tableOk || !colOk) {
        missing.push(`${descriptor.table}.${descriptor.column}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("H: prod.ts early pre-route preflight block covers every CRITICAL_COLUMNS entry", async () => {
    const { CRITICAL_COLUMNS } = await import(
      "../../server/bootstrap/assertColumnsExist"
    );
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");
    const block = extractProdEarlyPreflightBlock(src);

    const missing: string[] = [];
    for (const descriptor of CRITICAL_COLUMNS) {
      const tableOk = block.includes(descriptor.table);
      const colOk = block.includes(descriptor.column);
      if (!tableOk || !colOk) {
        missing.push(`${descriptor.table}.${descriptor.column}`);
      }
    }

    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// I — sequencing: prod.ts clinical labs migrations run before registerRoutes
// ---------------------------------------------------------------------------

describe("prod.ts boot sequencing guard", () => {
  const root = path.resolve(__dirname, "../..");

  it("I: prod.ts runs CRITICAL_COLUMNS pre-route preflight migrations before registerRoutes", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // The awaited pre-route preflight block must appear before registerRoutes
    const preflightIdx = src.indexOf(
      "CRITICAL_COLUMNS pre-route preflight — all entries awaited before routes mount",
    );
    const registerRoutesIdx = src.indexOf("await registerRoutes(app)");

    expect(preflightIdx).toBeGreaterThan(-1);
    expect(registerRoutesIdx).toBeGreaterThan(-1);
    expect(preflightIdx).toBeLessThan(registerRoutesIdx);
  });

  it("I: prod.ts runs assertColumnsExist (column guard) before registerRoutes", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // The early column guard block (with process.exit) must appear before registerRoutes
    const earlyGuardIdx = src.indexOf(
      "Column guard — awaited before routes mount",
    );
    const registerRoutesIdx = src.indexOf("await registerRoutes(app)");

    expect(earlyGuardIdx).toBeGreaterThan(-1);
    expect(registerRoutesIdx).toBeGreaterThan(-1);
    expect(earlyGuardIdx).toBeLessThan(registerRoutesIdx);
  });

  it("I: prod.ts calls process.exit(1) when the early column guard fails", () => {
    const src = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // Extract the early guard block (before registerRoutes) and confirm it exits
    const guardMarker = "Column guard — awaited before routes mount";
    const guardIdx = src.indexOf(guardMarker);
    expect(guardIdx).toBeGreaterThan(-1);

    // Find the closest process.exit(1) after the guard marker
    const exitIdx = src.indexOf("process.exit(1)", guardIdx);
    const registerRoutesIdx = src.indexOf("await registerRoutes(app)");

    expect(exitIdx).toBeGreaterThan(-1);
    // The process.exit must come before registerRoutes (still in the guard block)
    expect(exitIdx).toBeLessThan(registerRoutesIdx);
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
//     pre-flight ALTER statements for every column in CRITICAL_COLUMNS.
//     Both files use the shared constant, so "asserted columns" == CRITICAL_COLUMNS.
// ---------------------------------------------------------------------------

describe("boot path parity — every CRITICAL_COLUMNS entry has a pre-flight ALTER in both index.ts and prod.ts", () => {
  const root = path.resolve(__dirname, "../..");

  /**
   * Parse all `ALTER TABLE … ADD COLUMN IF NOT EXISTS` targets from the
   * preflight section of the given source, returning Set of "table.column".
   *
   * For index.ts: uses the withBootRetry("Critical column pre-flight migrations") block.
   * For prod.ts:  uses the early CRITICAL_COLUMNS pre-route preflight block.
   */
  function parsePreflightColumns(src: string, filePath: string): Set<string> {
    // prod.ts uses the early pre-route preflight block (before registerRoutes);
    // index.ts uses the withBootRetry block.
    const isProd = filePath.endsWith("prod.ts");
    const marker = isProd
      ? "CRITICAL_COLUMNS pre-route preflight — all entries awaited before routes mount"
      : 'withBootRetry("Critical column pre-flight migrations"';

    const start = src.indexOf(marker);
    expect(start).toBeGreaterThan(-1);

    // Capture up to the nearest closing landmark: `await registerRoutes` for prod,
    // `assertColumnsExist` call for index (the guard that follows the preflight).
    const endMarker = isProd
      ? "await registerRoutes(app)"
      : "await assertColumnsExist(";
    const end = src.indexOf(endMarker, start);
    expect(end).toBeGreaterThan(start);

    const block = src.slice(start, end);

    const re = /ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/g;
    const result = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      result.add(`${m[1]}.${m[2]}`);
    }
    return result;
  }

  it("I (index.ts): every CRITICAL_COLUMNS entry is pre-migrated in the preflight block", async () => {
    const { CRITICAL_COLUMNS } = await import(
      "../../server/bootstrap/assertColumnsExist"
    );
    const filePath = path.join(root, "server/index.ts");
    const src = fs.readFileSync(filePath, "utf8");
    const preflight = parsePreflightColumns(src, filePath);

    const missing = CRITICAL_COLUMNS.filter(
      (d) => !preflight.has(`${d.table}.${d.column}`),
    ).map((d) => `${d.table}.${d.column}`);

    expect(missing).toEqual([]);
  });

  it("I (prod.ts): every CRITICAL_COLUMNS entry is pre-migrated in the early pre-route preflight block", async () => {
    const { CRITICAL_COLUMNS } = await import(
      "../../server/bootstrap/assertColumnsExist"
    );
    const filePath = path.join(root, "server/prod.ts");
    const src = fs.readFileSync(filePath, "utf8");
    const preflight = parsePreflightColumns(src, filePath);

    const missing = CRITICAL_COLUMNS.filter(
      (d) => !preflight.has(`${d.table}.${d.column}`),
    ).map((d) => `${d.table}.${d.column}`);

    expect(missing).toEqual([]);
  });

  it("I: both boot paths use CRITICAL_COLUMNS as the single source of truth (no drift)", () => {
    const indexSrc = fs.readFileSync(path.join(root, "server/index.ts"), "utf8");
    const prodSrc = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");

    // Both files must import and call assertColumnsExist with CRITICAL_COLUMNS —
    // no inline descriptor arrays.
    expect(indexSrc).toMatch(/assertColumnsExist\s*\(\s*\w+\s*,\s*CRITICAL_COLUMNS\s*\)/);
    expect(prodSrc).toMatch(/assertColumnsExist\s*\(\s*\w+\s*,\s*CRITICAL_COLUMNS\s*\)/);

    // Neither file should pass an inline array literal to assertColumnsExist
    const inlinePattern = /assertColumnsExist\s*\([^)]*table\s*:/s;
    expect(indexSrc).not.toMatch(inlinePattern);
    expect(prodSrc).not.toMatch(inlinePattern);
  });
});
