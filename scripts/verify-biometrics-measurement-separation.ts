#!/usr/bin/env npx tsx
/**
 * verify-biometrics-measurement-separation.ts
 *
 * Static-analysis + contract audit for the biometrics route separation:
 *   - POST /api/biometrics/measurement  → tracking only; MUST NOT update users.weight
 *   - POST /api/biometrics/weight       → prescription update; MUST update users.weight
 *   - GET  /api/biometrics/history      → display endpoint; MUST normalise units
 *   - POST /api/biometrics/ingest       → ingest; MUST upsert waist by day, not always insert
 *
 * Run:  npx tsx scripts/verify-biometrics-measurement-separation.ts
 * Exit: 0 if all checks pass, 1 if any fail.
 */

import * as fs from "fs";
import * as path from "path";

const ROUTE_FILE = path.resolve(process.cwd(), "server/routes/biometricsRoutes.ts");

if (!fs.existsSync(ROUTE_FILE)) {
  console.error(`Route file not found: ${ROUTE_FILE}`);
  process.exit(1);
}

const source = fs.readFileSync(ROUTE_FILE, "utf-8");

// ── helpers ───────────────────────────────────────────────────────────────────

function extractHandler(method: "get" | "post", routePath: string): string {
  const marker = `router.${method}('${routePath}'`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Route not found: ${method.toUpperCase()} ${routePath}`);
  // Slice up to the next router.X( declaration so we only inspect this handler
  const nextRoute = source.indexOf("\nrouter.", start + marker.length);
  return nextRoute > -1 ? source.slice(start, nextRoute) : source.slice(start);
}

interface Check { name: string; passed: boolean; detail: string }
const results: Check[] = [];

function check(name: string, condition: boolean, passMsg: string, failMsg: string) {
  results.push({ name, passed: condition, detail: condition ? passMsg : failMsg });
}

// ── extract handlers ──────────────────────────────────────────────────────────

const measurementHandler = extractHandler("post", "/measurement");
const weightHandler       = extractHandler("post", "/weight");
const historyHandler      = extractHandler("get",  "/history");
const ingestHandler       = extractHandler("post", "/ingest");

// ── check 1: /measurement MUST NOT write to the users table ──────────────────
check(
  "/measurement does not update users.weight",
  !measurementHandler.includes("update(users)") &&
  !measurementHandler.includes(".set({ weight"),
  "✓ /measurement has no users.weight write — prescription baseline stays intact",
  "✗ /measurement contains a users-table update. Logging a measurement must never change the macro prescription baseline.",
);

// ── check 2: /weight MUST update users table (prescription path) ──────────────
check(
  "/weight updates users.weight (prescription baseline)",
  weightHandler.includes("update(users)"),
  "✓ /weight writes to the users table — macro prescription baseline is updated correctly",
  "✗ /weight does not update users.weight. The macro prescription baseline will not change when users save from the Macro Calculator.",
);

// ── check 3: /measurement has same-day dedup ─────────────────────────────────
check(
  "/measurement uses same-day upsert (no duplicate rows per day)",
  measurementHandler.includes("dayStart") && measurementHandler.includes("dayEnd"),
  "✓ /measurement has same-day dedup — repeated saves replace rather than stack",
  "✗ /measurement is missing same-day boundary logic. Multiple saves on the same day will create duplicate rows.",
);

// ── check 4: /weight has same-day dedup ──────────────────────────────────────
check(
  "/weight uses same-day dedup",
  weightHandler.includes("sameDayEntry") ||
  (weightHandler.includes("dayKey") && weightHandler.includes("updated")),
  "✓ /weight has same-day dedup",
  "✗ /weight is missing same-day dedup logic.",
);

// ── check 5: /history normalises units ───────────────────────────────────────
check(
  "/history normalises weight → lb and waist → inches for display",
  historyHandler.includes("2.20462") && historyHandler.includes("2.54"),
  "✓ /history converts weight to lb and waist to in before responding",
  "✗ /history is missing unit normalisation — clients may receive raw kg/cm values.",
);

// ── check 6: /ingest upserts waist by day (no accumulating duplicates) ────────
check(
  "/ingest upserts waist_circumference by day (not always-insert)",
  ingestHandler.includes("waist_circumference") &&
  ingestHandler.includes("updatedCount") &&
  (ingestHandler.includes("dayStart") || ingestHandler.includes("dayKey")),
  "✓ /ingest checks for an existing same-day waist row and upserts instead of inserting",
  "✗ /ingest always inserts waist rows. Multiple MacroCalculator saves on the same day will stack up duplicate waist entries.",
);

// ── check 7: /measurement does NOT call /weight's prescription logic ──────────
check(
  "/measurement does not call updateUserSubscription or update users table indirectly",
  !measurementHandler.includes("updateUserSubscription") &&
  !measurementHandler.includes("users.weight"),
  "✓ No indirect prescription updates in /measurement",
  "✗ /measurement may be calling subscription or user-update utilities that alter the prescription.",
);

// ── print results ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
console.log("\n══════ Biometrics: Measurement vs Prescription Separation ══════\n");
for (const r of results) {
  console.log(r.detail);
  r.passed ? passed++ : failed++;
}

console.log(`\n──────────────────────────────────────────────────────────────`);
console.log(`Result: ${passed}/${results.length} checks passed${failed > 0 ? ` — ${failed} FAILED` : " ✓"}`);
console.log(`──────────────────────────────────────────────────────────────\n`);

if (failed > 0) process.exit(1);
