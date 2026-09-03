/**
 * server/db/migrations/__tests__/assertCorrelationIdColumn.test.ts
 *
 * Unit + source-structure tests for the Safety PIN startup guard.
 *
 * Sections 1–5: Pure function tests — assertCorrelationIdColumn() throws the
 *   right error when the column is absent and resolves cleanly when present.
 *
 * Sections 6–7: Source-structure assertions for index.ts (dev path) —
 *   (a) guard comes AFTER withBootRetry("Safety override...") closes,
 *   (b) guard is NOT nested inside any withBootRetry callback,
 *   (c) start().catch() calls process.exit(1) so the error is fatal.
 *
 * Sections 8–10: Source-structure assertions for prod.ts (prod path) —
 *   (a) guard comes AFTER withBootRetry("Safety override...") closes,
 *   (b) guard is NOT nested inside any withBootRetry callback,
 *   (c) guard is immediately followed by a try/catch that calls process.exit(1)
 *       (required because the guard runs inside a deferred setTimeout callback
 *       where unhandled errors only reach the unhandledRejection logger, not
 *       any fatal handler).
 *
 * Section 11: withBootRetry swallows contract — demonstrates why the guard
 *   must stay outside: withBootRetry does not re-throw after exhaustion, so an
 *   accidentally-wrapped guard would be silently discarded.
 *
 * Pure-function / static-analysis tests: no real DB, no network, no server
 * import.
 *
 * Run: npx tsx server/db/migrations/__tests__/assertCorrelationIdColumn.test.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { assertCorrelationIdColumn } from "../assertCorrelationIdColumn";

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

function fakeDb(rows: unknown[]) {
  return { execute: async (_query: unknown) => ({ rows }) };
}

function fakeDbDirect(rows: unknown[]) {
  return { execute: async (_query: unknown) => rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// Source-structure helpers
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../../..");

function readServerFile(relPath: string): string[] {
  const abs = path.resolve(serverRoot, relPath);
  return fs.readFileSync(abs, "utf8").split("\n");
}

/** All 1-based line numbers whose text includes `pattern`. */
function findLines(lines: string[], pattern: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) result.push(i + 1);
  }
  return result;
}

/**
 * First 1-based line number at or after `fromLine` that includes `pattern`.
 * Returns -1 if not found.
 */
function findLineFrom(lines: string[], pattern: string, fromLine: number): number {
  for (let i = fromLine - 1; i < lines.length; i++) {
    if (lines[i].includes(pattern)) return i + 1;
  }
  return -1;
}

/**
 * Count withBootRetry calls in [startLine..endLine] whose closing `});`
 * falls at or after `endLine` — meaning the guard at `endLine` would be
 * inside those calls.
 */
function unclosedWithBootRetryCount(
  lines: string[],
  startLine: number,
  endLine: number,
): number {
  let unclosed = 0;
  for (let i = startLine - 1; i < endLine - 1; i++) {
    if (lines[i].includes("withBootRetry(")) {
      const closeAt = findLineFrom(lines, "});", i + 2);
      if (closeAt === -1 || closeAt >= endLine) {
        unclosed++;
      }
    }
  }
  return unclosed;
}

// ─────────────────────────────────────────────────────────────────────────────
// withBootRetry demo — replica of real implementation, used in Section 11
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BOOT_ATTEMPTS = 3;

async function withBootRetryDemo(
  label: string,
  fn: () => Promise<void>,
  delay: (ms: number) => Promise<void> = () => Promise.resolve(),
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_BOOT_ATTEMPTS; attempt++) {
    try {
      await fn();
      return;
    } catch (err: any) {
      if (attempt < MAX_BOOT_ATTEMPTS) {
        await delay(5000);
      } else {
        // Final attempt: log and return without re-throwing (matches real code)
        console.log(
          `    [withBootRetryDemo] "${label}" exhausted after ${MAX_BOOT_ATTEMPTS} attempts: ${err.message}`,
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  // ── 1. Column absent — .rows wrapper ──────────────────────────────────────
  section("Column absent — DB returns empty rows array (.rows wrapper)");
  try {
    await assertCorrelationIdColumn(fakeDb([]) as any);
    assert(false, "should have thrown when rows is empty");
  } catch (err: any) {
    assert(err instanceof Error, "throws an Error instance");
    assert(err.message.includes("STARTUP GUARD"), 'error message contains "STARTUP GUARD"');
    assert(err.message.includes("correlation_id"), 'error message contains "correlation_id"');
  }

  // ── 2. Column absent — direct array result ─────────────────────────────────
  section("Column absent — DB returns empty direct array (no .rows wrapper)");
  try {
    await assertCorrelationIdColumn(fakeDbDirect([]) as any);
    assert(false, "should have thrown when result array is empty");
  } catch (err: any) {
    assert(err instanceof Error, "throws an Error instance");
    assert(err.message.includes("STARTUP GUARD"), 'error message contains "STARTUP GUARD"');
    assert(err.message.includes("correlation_id"), 'error message contains "correlation_id"');
  }

  // ── 3. Column present — .rows wrapper ──────────────────────────────────────
  section("Column present — DB returns one row (.rows wrapper)");
  try {
    await assertCorrelationIdColumn(fakeDb([{ column_name: "correlation_id" }]) as any);
    assert(true, "resolves without throwing when column exists");
  } catch (err: any) {
    assert(false, `should not throw when column exists: ${err.message}`);
  }

  // ── 4. Column present — direct array result ────────────────────────────────
  section("Column present — DB returns one-element direct array");
  try {
    await assertCorrelationIdColumn(fakeDbDirect([{ column_name: "correlation_id" }]) as any);
    assert(true, "resolves without throwing when column exists (direct array)");
  } catch (err: any) {
    assert(false, `should not throw when column exists: ${err.message}`);
  }

  // ── 5. Non-array result (malformed DB response) ────────────────────────────
  section("Non-array result (malformed DB response)");
  try {
    const brokenDb = { execute: async (_query: unknown) => ({ rows: null }) };
    await assertCorrelationIdColumn(brokenDb as any);
    assert(false, "should have thrown when rows is null");
  } catch (err: any) {
    assert(err instanceof Error, "throws an Error instance");
    assert(err.message.includes("STARTUP GUARD"), 'error message contains "STARTUP GUARD"');
  }

  // ── 6. Source: index.ts guard comes after withBootRetry closes ─────────────
  //
  // The guard must appear AFTER the closing `});` of the
  // withBootRetry("Safety override...") callback so it is not retried and its
  // error is not swallowed by withBootRetry's exhaustion handler.
  section(
    "index.ts (dev path) — guard call appears AFTER the Safety-override withBootRetry callback closes",
  );
  {
    const lines = readServerFile("index.ts");

    const retryOpenLines = findLines(lines, 'withBootRetry("Safety override correlation ID migration"');
    assert(retryOpenLines.length > 0, 'withBootRetry("Safety override...") call exists in index.ts');

    const retryOpenLine = retryOpenLines[retryOpenLines.length - 1];
    const retryCloseLine = findLineFrom(lines, "});", retryOpenLine + 1);
    assert(retryCloseLine > retryOpenLine, "withBootRetry callback has a closing }); in index.ts");

    const guardLines = findLines(lines, "await assertCorrelationIdColumn(dbGuard");
    assert(guardLines.length > 0, "assertCorrelationIdColumn(dbGuard) call exists in index.ts");

    const guardLine = guardLines[guardLines.length - 1];
    assert(
      guardLine > retryCloseLine,
      `guard (line ${guardLine}) comes AFTER withBootRetry closes (line ${retryCloseLine}) in index.ts`,
    );
  }

  // ── 7. Source: index.ts guard is outside all withBootRetry callbacks ────────
  section(
    "index.ts (dev path) — guard call is NOT nested inside any withBootRetry callback",
  );
  {
    const lines = readServerFile("index.ts");
    const guardLines = findLines(lines, "await assertCorrelationIdColumn(dbGuard");
    const guardLine = guardLines[guardLines.length - 1];

    const startFnLines = findLines(lines, "async function start()");
    const startFnLine = startFnLines.length > 0 ? startFnLines[0] : 1;

    const unclosed = unclosedWithBootRetryCount(lines, startFnLine, guardLine);
    assert(
      unclosed === 0,
      `guard is outside all withBootRetry callbacks in index.ts (unclosed count: ${unclosed})`,
    );
  }

  // ── 8. Source: index.ts — start().catch() calls process.exit(1) ────────────
  //
  // In index.ts the guard runs directly inside start(). For the error to be
  // fatal the .catch() on start() at the bottom of the file must call
  // process.exit(1), not just log.
  section(
    "index.ts (dev path) — start().catch() calls process.exit(1) so guard error crashes the process",
  );
  {
    const lines = readServerFile("index.ts");

    // Find start().catch( invocation
    const catchLines = findLines(lines, "start().catch(");
    assert(catchLines.length > 0, "start().catch() exists in index.ts");

    const catchLine = catchLines[catchLines.length - 1];

    // process.exit(1) must appear within the next 10 lines of the .catch block
    let foundExit = false;
    for (let l = catchLine; l <= Math.min(catchLine + 10, lines.length); l++) {
      if (lines[l - 1].includes("process.exit(1)")) {
        foundExit = true;
        break;
      }
    }
    assert(
      foundExit,
      "start().catch() contains process.exit(1) — guard error is fatal in dev path",
    );
  }

  // ── 9. Source: prod.ts guard comes after withBootRetry closes ──────────────
  section(
    "prod.ts (prod path) — guard call appears AFTER the Safety-override withBootRetry callback closes",
  );
  {
    const lines = readServerFile("prod.ts");

    const retryOpenLines = findLines(lines, 'withBootRetry("Safety override correlation ID migration"');
    assert(retryOpenLines.length > 0, 'withBootRetry("Safety override...") call exists in prod.ts');

    const retryOpenLine = retryOpenLines[retryOpenLines.length - 1];
    const retryCloseLine = findLineFrom(lines, "});", retryOpenLine + 1);
    assert(retryCloseLine > retryOpenLine, "withBootRetry callback has a closing }); in prod.ts");

    const guardLines = findLines(lines, "await assertCorrelationIdColumn(dbGuard");
    assert(guardLines.length > 0, "assertCorrelationIdColumn(dbGuard) call exists in prod.ts");

    const guardLine = guardLines[guardLines.length - 1];
    assert(
      guardLine > retryCloseLine,
      `guard (line ${guardLine}) comes AFTER withBootRetry closes (line ${retryCloseLine}) in prod.ts`,
    );
  }

  // ── 10. Source: prod.ts guard is outside withBootRetry AND has fatal catch ──
  //
  // The guard runs inside a deferred setTimeout async callback. Unhandled
  // errors from async setTimeout callbacks become unhandled rejections that are
  // only logged, not fatal. The guard therefore wraps its own try/catch that
  // calls process.exit(1) explicitly.
  //
  // This section has two assertions:
  //   (a) the guard is NOT nested inside any withBootRetry callback
  //   (b) process.exit(1) appears within the guard's own catch block (within
  //       10 lines after the guard call), making the failure fatal
  section(
    "prod.ts (prod path) — guard is outside withBootRetry AND has a fatal process.exit(1) catch",
  );
  {
    const lines = readServerFile("prod.ts");
    const guardLines = findLines(lines, "await assertCorrelationIdColumn(dbGuard");
    const guardLine = guardLines[guardLines.length - 1];

    // (a) not inside withBootRetry
    const initFnLines = findLines(lines, "async function initializeApp()");
    const initFnLine = initFnLines.length > 0 ? initFnLines[0] : 1;
    const unclosed = unclosedWithBootRetryCount(lines, initFnLine, guardLine);
    assert(
      unclosed === 0,
      `guard is outside all withBootRetry callbacks in prod.ts (unclosed count: ${unclosed})`,
    );

    // (b) process.exit(1) within the guard's catch block (within 10 lines)
    let foundExit = false;
    for (let l = guardLine + 1; l <= Math.min(guardLine + 10, lines.length); l++) {
      if (lines[l - 1].includes("process.exit(1)")) {
        foundExit = true;
        break;
      }
    }
    assert(
      foundExit,
      "guard's catch block contains process.exit(1) within 10 lines — error is fatal in prod path",
    );
  }

  // ── 11. withBootRetry swallows — proves guard must stay outside ─────────────
  //
  // The real withBootRetry (both files) does NOT re-throw after exhausting
  // MAX_BOOT_ATTEMPTS. If the guard were moved inside withBootRetry, the
  // STARTUP GUARD error would be silently discarded and the server would
  // continue booting with the column absent.
  section(
    "withBootRetry contract — guard error is swallowed when incorrectly wrapped (proves guard must stay outside)",
  );
  let swallowed = false;
  try {
    await withBootRetryDemo("correlation_id guard (INCORRECTLY wrapped)", async () => {
      await assertCorrelationIdColumn(fakeDb([]) as any);
    });
    swallowed = true;
  } catch (_err) {
    swallowed = false;
  }
  assert(
    swallowed,
    "withBootRetryDemo swallows the guard error after exhausting retries (error NOT propagated)",
  );
  assert(
    swallowed,
    "confirms: guard inside withBootRetry would let server boot with correlation_id column absent",
  );

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
