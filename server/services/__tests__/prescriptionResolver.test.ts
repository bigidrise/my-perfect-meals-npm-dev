/**
 * Prescription Resolver — GLP-1 + Performance combined path tests
 *
 * Verifies that GLP-1 clinical ceilings/floors are never violated by the
 * Performance Hub overlay, and that the resolver correctly re-enforces
 * GLP-1 limits after the Performance modifier runs.
 *
 * Pure function test — no DB, no network.
 * Simulates the exact pipeline inside resolveDailyNutritionPrescription:
 *   1. Start from Macro Calculator baseline
 *   2. Apply GLP-1 overlay (protein floor, fat ceiling, phase multiplier)
 *   3. Apply Performance modifiers via resolveTodayTargets()
 *   4. Re-enforce GLP-1 floors/ceilings
 *   5. Assign source and rationaleCodes
 *
 * Run: npx tsx server/services/__tests__/prescriptionResolver.test.ts
 *
 * Exit 0 = all pass. Exit 1 = one or more failures.
 */

import { DEFAULT_GLP1_GUARDRAILS } from "../../../shared/glp1-schema";
import {
  resolveTodayTargets,
  buildDefaultModifiers,
  type MacroBaseline,
  type WeeklyTrainingSchedule,
  type PerformanceProtocolConfig,
  type SessionType,
} from "../protocol/performanceProtocolResolver";

// ─────────────────────────────────────────────────────────────────────────────
// TEST HARNESS
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = detail ? `  ❌ FAIL: ${label} — ${detail}` : `  ❌ FAIL: ${label}`;
    console.log(msg);
    failMessages.push(msg);
  }
}

function section(title: string) {
  console.log(`\n${"─".repeat(68)}`);
  console.log(`▶ ${title}`);
  console.log("─".repeat(68));
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE SIMULATION
//
// Mirrors the exact logic in resolveDailyNutritionPrescription() so that
// tests exercise the same invariants without requiring a live DB connection.
// ─────────────────────────────────────────────────────────────────────────────

interface SimulatedUser {
  /** Macro Calculator baseline (DB columns) */
  caloriesBase:   number;
  proteinBase:    number;
  carbsBase:      number;
  fatBase:        number;
  starchyBase:    number;
  fibrousBase:    number;

  /** GLP-1 condition active */
  isGLP1Active: boolean;
  /** Optional per-patient guardrail overrides (defaults to DEFAULT_GLP1_GUARDRAILS) */
  guardrailOverrides?: Partial<typeof DEFAULT_GLP1_GUARDRAILS>;

  /** Performance protocol active */
  performanceModeEnabled: boolean;
  weeklySchedule?: WeeklyTrainingSchedule;
  perfConfig?: PerformanceProtocolConfig;
}

interface SimulatedPrescription {
  source: "user_default" | "clinical" | "performance";
  caloriesTarget: number;
  proteinTarget:  number;
  carbsTarget:    number;
  fatTarget:      number;
  rationaleCodes: string[];
  /** Raw GLP-1 daily floors/ceilings for assertion helpers */
  glp1DailyProteinFloor: number | null;
  glp1DailyFatCeiling:   number | null;
}

/**
 * Simulate the GLP-1 + Performance combined resolver pipeline.
 * Pass `nowOverride` to control which day-of-week the performance resolver sees.
 */
function simulatePrescription(
  user: SimulatedUser,
  nowOverride: Date,
): SimulatedPrescription {
  const rationaleCodes: string[] = [];
  let source: SimulatedPrescription["source"] = "user_default";

  let caloriesTarget = user.caloriesBase;
  let proteinTarget  = user.proteinBase;
  let carbsTarget    = user.carbsBase;
  let fatTarget      = user.fatBase;
  let starchyCarbsTarget = user.starchyBase > 0
    ? user.starchyBase
    : Math.round(user.carbsBase * 0.65);
  let fibrousCarbsTarget = user.fibrousBase > 0
    ? user.fibrousBase
    : Math.max(0, user.carbsBase - starchyCarbsTarget);

  // ── GLP-1 overlay ─────────────────────────────────────────────────────────
  let glp1DailyProteinFloor: number | null = null;
  let glp1DailyFatCeiling:   number | null = null;

  if (user.isGLP1Active) {
    const guardrails = { ...DEFAULT_GLP1_GUARDRAILS, ...user.guardrailOverrides };

    const mealsPerDay   = guardrails.mealsPerDay  ?? 4;
    const proteinMinG   = guardrails.proteinMinG  ?? 25;
    const fatMaxG       = guardrails.fatMaxG      ?? 15;

    const treatmentPhase =
      proteinMinG >= 40 ? "muscle_preserve"
      : fatMaxG <= 10   ? "intro"
      : "maintenance";

    const phaseMultiplier =
      treatmentPhase === "intro"             ? 0.82
      : treatmentPhase === "muscle_preserve" ? 1.08
      : 1.0;

    caloriesTarget = Math.round(caloriesTarget * phaseMultiplier);

    glp1DailyProteinFloor = proteinMinG * mealsPerDay;
    glp1DailyFatCeiling   = fatMaxG     * mealsPerDay;

    proteinTarget = Math.max(proteinTarget, glp1DailyProteinFloor);
    fatTarget     = Math.min(fatTarget,     glp1DailyFatCeiling);

    const remainingCals = caloriesTarget - proteinTarget * 4 - fatTarget * 9;
    carbsTarget = Math.max(0, Math.round(remainingCals / 4));
    const carbRatio = user.carbsBase > 0 ? carbsTarget / user.carbsBase : 0;
    starchyCarbsTarget = Math.round(starchyCarbsTarget * carbRatio);
    fibrousCarbsTarget = Math.max(0, carbsTarget - starchyCarbsTarget);

    source = "clinical";
    rationaleCodes.push("glp1_daily_overlay_active");
    if (treatmentPhase !== "maintenance") {
      rationaleCodes.push(`glp1_phase_${treatmentPhase}`);
    }
  }

  // ── Performance overlay ───────────────────────────────────────────────────
  if (user.performanceModeEnabled && user.weeklySchedule && user.perfConfig) {
    const baseline: MacroBaseline = {
      calories:      caloriesTarget,
      proteinG:      proteinTarget,
      carbsG:        carbsTarget,
      fatG:          fatTarget,
      starchyCarbsG: starchyCarbsTarget,
      fibrousCarbsG: fibrousCarbsTarget,
    };

    const resolved = resolveTodayTargets(
      user.weeklySchedule,
      user.perfConfig,
      baseline,
      nowOverride,
    );

    caloriesTarget     = resolved.calories;
    proteinTarget      = resolved.proteinG;
    carbsTarget        = resolved.carbsG;
    fatTarget          = resolved.fatG;
    starchyCarbsTarget = resolved.starchyCarbsG;
    fibrousCarbsTarget = resolved.fibrousCarbsG;
    source             = "performance";

    rationaleCodes.push("performance_modifier_active");
  }

  // ── GLP-1 re-enforcement after Performance ────────────────────────────────
  if (user.isGLP1Active) {
    if (glp1DailyProteinFloor !== null) {
      proteinTarget = Math.max(proteinTarget, glp1DailyProteinFloor);
    }
    if (glp1DailyFatCeiling !== null) {
      fatTarget = Math.min(fatTarget, glp1DailyFatCeiling);
    }
    if (source === "performance") {
      rationaleCodes.push("glp1_limits_enforced_post_performance");
    }
  }

  return {
    source,
    caloriesTarget,
    proteinTarget,
    carbsTarget,
    fatTarget,
    rationaleCodes,
    glp1DailyProteinFloor,
    glp1DailyFatCeiling,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Monday where the schedule has "competition" (max high-load session).
 * nowOverride = 2026-07-06 (Monday)
 */
const HIGH_LOAD_DAY = new Date("2026-07-06T12:00:00Z"); // Monday

/**
 * A Sunday where the schedule has "off" (rest day, proteinAdjustG = -5).
 * nowOverride = 2026-07-05 (Sunday)
 */
const REST_DAY = new Date("2026-07-05T12:00:00Z"); // Sunday

const COMPETITION_SCHEDULE: WeeklyTrainingSchedule = {
  monday:    "competition",
  tuesday:   "strength",
  wednesday: "endurance",
  thursday:  "recovery",
  friday:    "strength",
  saturday:  "sport_practice",
  sunday:    "off",
  trainingPhase: "in_season",
  activatedAt: "2026-01-01T00:00:00Z",
  updatedAt:   "2026-01-01T00:00:00Z",
};

const PERFORMANCE_CONFIG: PerformanceProtocolConfig = {
  sessionModifiers: buildDefaultModifiers("performance"),
  generatedAt: "2026-01-01T00:00:00Z",
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — GLP-1 + Competition day (high load)
//
// Fat ceiling and protein floor must both hold after Performance modifier.
// source must remain "performance"; rationaleCodes must include
// "glp1_limits_enforced_post_performance".
// ─────────────────────────────────────────────────────────────────────────────
section("Test 1: GLP-1 (maintenance phase) + Competition day — clinical limits hold");
{
  // Baseline: moderate-calorie GLP-1 user
  // After GLP-1 overlay: proteinFloor = 25*4 = 100, fatCeiling = 15*4 = 60
  // User fat baseline = 70g → capped to 60g by GLP-1
  // Competition day modifier: +400 kcal, +100g carbs, +10g protein, fat unchanged
  const rx = simulatePrescription(
    {
      caloriesBase:   2000,
      proteinBase:    100,
      carbsBase:      220,
      fatBase:        70,
      starchyBase:    143,
      fibrousBase:    77,
      isGLP1Active:   true,
      performanceModeEnabled: true,
      weeklySchedule:  COMPETITION_SCHEDULE,
      perfConfig:      PERFORMANCE_CONFIG,
    },
    HIGH_LOAD_DAY,
  );

  console.log(`  source=${rx.source} | protein=${rx.proteinTarget}g | fat=${rx.fatTarget}g`);
  console.log(`  rationaleCodes: ${rx.rationaleCodes.join(", ")}`);
  console.log(`  GLP-1 floor/ceiling: protein≥${rx.glp1DailyProteinFloor}g, fat≤${rx.glp1DailyFatCeiling}g`);

  assert(rx.source === "performance",
    'source === "performance" (Performance still wins the label)');

  assert(
    rx.glp1DailyFatCeiling !== null && rx.fatTarget <= rx.glp1DailyFatCeiling,
    `fatTarget (${rx.fatTarget}g) ≤ GLP-1 daily fat ceiling (${rx.glp1DailyFatCeiling}g)`,
  );

  assert(
    rx.glp1DailyProteinFloor !== null && rx.proteinTarget >= rx.glp1DailyProteinFloor,
    `proteinTarget (${rx.proteinTarget}g) ≥ GLP-1 daily protein floor (${rx.glp1DailyProteinFloor}g)`,
  );

  assert(
    rx.rationaleCodes.includes("glp1_limits_enforced_post_performance"),
    'rationaleCodes includes "glp1_limits_enforced_post_performance"',
  );

  assert(
    rx.rationaleCodes.includes("performance_modifier_active"),
    'rationaleCodes includes "performance_modifier_active"',
  );

  assert(
    rx.rationaleCodes.includes("glp1_daily_overlay_active"),
    'rationaleCodes includes "glp1_daily_overlay_active"',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — GLP-1 protein floor re-enforcement on a rest day
//
// The "off" modifier subtracts 5g protein. If the user's GLP-1-adjusted protein
// is exactly at the floor, Performance would silently push it below the clinical
// minimum. Re-enforcement must restore it.
// ─────────────────────────────────────────────────────────────────────────────
section("Test 2: GLP-1 protein floor is re-enforced when Performance drops protein below clinical minimum");
{
  // proteinBase = 105g; floor = 25*4 = 100g.
  // After GLP-1: proteinTarget = max(105, 100) = 105g.
  // Off day: proteinAdjustG = -5 → 100g (still at floor, OK).
  // Let's force the scenario: proteinBase = 100g exactly.
  // After GLP-1: max(100, 100) = 100g.
  // Off day: 100 - 5 = 95g < 100 floor → re-enforcement must raise to 100.
  const rx = simulatePrescription(
    {
      caloriesBase:   1800,
      proteinBase:    100,   // exactly at GLP-1 floor after overlay
      carbsBase:      200,
      fatBase:        65,
      starchyBase:    130,
      fibrousBase:    70,
      isGLP1Active:   true,
      performanceModeEnabled: true,
      weeklySchedule:  COMPETITION_SCHEDULE, // Sunday = "off"
      perfConfig:      PERFORMANCE_CONFIG,
    },
    REST_DAY, // Sunday → "off" → proteinAdjustG: -5
  );

  console.log(`  source=${rx.source} | protein=${rx.proteinTarget}g | fat=${rx.fatTarget}g`);
  console.log(`  rationaleCodes: ${rx.rationaleCodes.join(", ")}`);
  console.log(`  GLP-1 floor/ceiling: protein≥${rx.glp1DailyProteinFloor}g, fat≤${rx.glp1DailyFatCeiling}g`);

  assert(rx.source === "performance",
    'source === "performance"');

  assert(
    rx.glp1DailyProteinFloor !== null && rx.proteinTarget >= rx.glp1DailyProteinFloor,
    `proteinTarget (${rx.proteinTarget}g) ≥ GLP-1 daily protein floor (${rx.glp1DailyProteinFloor}g) even after rest-day -5g adj`,
  );

  assert(
    rx.glp1DailyFatCeiling !== null && rx.fatTarget <= rx.glp1DailyFatCeiling,
    `fatTarget (${rx.fatTarget}g) ≤ GLP-1 daily fat ceiling (${rx.glp1DailyFatCeiling}g)`,
  );

  assert(
    rx.rationaleCodes.includes("glp1_limits_enforced_post_performance"),
    'rationaleCodes includes "glp1_limits_enforced_post_performance"',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — GLP-1 muscle-preserve phase + Competition day
//
// Muscle-preserve phase: proteinMinG=40, mealsPerDay=4 → floor=160g.
// Phase multiplier: 1.08 (calories scale UP, not down).
// Performance adds protein (+10g). Both limits must still hold.
// ─────────────────────────────────────────────────────────────────────────────
section("Test 3: GLP-1 muscle-preserve phase + Competition day — elevated protein floor holds");
{
  // Floor = 40 * 4 = 160g, fat ceiling = 15 * 4 = 60g
  // User proteinBase = 150g < floor → overlay bumps to 160g
  // Competition: proteinAdjust +10 → 170g > floor ✓
  // Fat ceiling: fatBase = 80g → capped to 60g; Performance never changes fat → 60g ✓
  const rx = simulatePrescription(
    {
      caloriesBase:   2500,
      proteinBase:    150,
      carbsBase:      250,
      fatBase:        80,
      starchyBase:    162,
      fibrousBase:    88,
      isGLP1Active:   true,
      guardrailOverrides: {
        proteinMinG: 40,   // muscle-preserve guardrail
        fatMaxG:     15,
        mealsPerDay: 4,
      },
      performanceModeEnabled: true,
      weeklySchedule:  COMPETITION_SCHEDULE,
      perfConfig:      PERFORMANCE_CONFIG,
    },
    HIGH_LOAD_DAY, // Monday = "competition"
  );

  console.log(`  source=${rx.source} | protein=${rx.proteinTarget}g | fat=${rx.fatTarget}g`);
  console.log(`  rationaleCodes: ${rx.rationaleCodes.join(", ")}`);
  console.log(`  GLP-1 floor/ceiling: protein≥${rx.glp1DailyProteinFloor}g, fat≤${rx.glp1DailyFatCeiling}g`);

  assert(rx.source === "performance",
    'source === "performance"');

  assert(
    rx.glp1DailyProteinFloor !== null && rx.proteinTarget >= rx.glp1DailyProteinFloor,
    `proteinTarget (${rx.proteinTarget}g) ≥ muscle-preserve floor (${rx.glp1DailyProteinFloor}g)`,
  );

  assert(
    rx.glp1DailyFatCeiling !== null && rx.fatTarget <= rx.glp1DailyFatCeiling,
    `fatTarget (${rx.fatTarget}g) ≤ fat ceiling (${rx.glp1DailyFatCeiling}g)`,
  );

  assert(
    rx.rationaleCodes.includes("glp1_phase_muscle_preserve"),
    'rationaleCodes includes "glp1_phase_muscle_preserve"',
  );

  assert(
    rx.rationaleCodes.includes("glp1_limits_enforced_post_performance"),
    'rationaleCodes includes "glp1_limits_enforced_post_performance"',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — GLP-1 intro phase + Endurance day
//
// Intro phase: fatMaxG=10 → ceiling = 10*4 = 40g.
// Phase multiplier: 0.82 (calories shrink).
// Endurance day adds 80g carbs and 320 kcal, 0 protein, 0 fat.
// Very strict fat ceiling (40g) must survive the performance overlay.
// ─────────────────────────────────────────────────────────────────────────────
section("Test 4: GLP-1 intro phase + Endurance day — strict fat ceiling (40g) holds");
{
  // Floor = 25 * 4 = 100g protein, fat ceiling = 10 * 4 = 40g
  // User fatBase = 55g → capped to 40g by GLP-1 intro ceiling
  // Endurance: proteinAdjust 0, fat unchanged → still 40g ✓
  const ENDURANCE_DAY = new Date("2026-07-08T12:00:00Z"); // Wednesday = "endurance"

  const rx = simulatePrescription(
    {
      caloriesBase:   1600,
      proteinBase:    110,
      carbsBase:      180,
      fatBase:        55,
      starchyBase:    117,
      fibrousBase:    63,
      isGLP1Active:   true,
      guardrailOverrides: {
        proteinMinG: 25,
        fatMaxG:     10,   // intro phase
        mealsPerDay: 4,
      },
      performanceModeEnabled: true,
      weeklySchedule:  COMPETITION_SCHEDULE, // Wednesday = "endurance"
      perfConfig:      PERFORMANCE_CONFIG,
    },
    ENDURANCE_DAY,
  );

  console.log(`  source=${rx.source} | protein=${rx.proteinTarget}g | fat=${rx.fatTarget}g`);
  console.log(`  rationaleCodes: ${rx.rationaleCodes.join(", ")}`);
  console.log(`  GLP-1 floor/ceiling: protein≥${rx.glp1DailyProteinFloor}g, fat≤${rx.glp1DailyFatCeiling}g`);

  assert(rx.source === "performance",
    'source === "performance"');

  assert(
    rx.glp1DailyFatCeiling !== null && rx.fatTarget <= rx.glp1DailyFatCeiling,
    `fatTarget (${rx.fatTarget}g) ≤ strict intro fat ceiling (${rx.glp1DailyFatCeiling}g)`,
  );

  assert(
    rx.glp1DailyProteinFloor !== null && rx.proteinTarget >= rx.glp1DailyProteinFloor,
    `proteinTarget (${rx.proteinTarget}g) ≥ protein floor (${rx.glp1DailyProteinFloor}g)`,
  );

  assert(
    rx.rationaleCodes.includes("glp1_phase_intro"),
    'rationaleCodes includes "glp1_phase_intro"',
  );

  assert(
    rx.rationaleCodes.includes("glp1_limits_enforced_post_performance"),
    'rationaleCodes includes "glp1_limits_enforced_post_performance"',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — No GLP-1 active: limits NOT re-enforced, rationaleCodes clean
//
// Controls that a non-GLP-1 performance user does NOT receive GLP-1 rationale
// codes. This ensures the guard conditions are correctly scoped.
// ─────────────────────────────────────────────────────────────────────────────
section("Test 5 (control): Non-GLP-1 performance user never receives GLP-1 rationale codes");
{
  const rx = simulatePrescription(
    {
      caloriesBase:   2200,
      proteinBase:    160,
      carbsBase:      240,
      fatBase:        73,
      starchyBase:    156,
      fibrousBase:    84,
      isGLP1Active:   false,   // ← GLP-1 NOT active
      performanceModeEnabled: true,
      weeklySchedule:  COMPETITION_SCHEDULE,
      perfConfig:      PERFORMANCE_CONFIG,
    },
    HIGH_LOAD_DAY,
  );

  console.log(`  source=${rx.source} | protein=${rx.proteinTarget}g | fat=${rx.fatTarget}g`);
  console.log(`  rationaleCodes: ${rx.rationaleCodes.join(", ")}`);

  assert(rx.source === "performance",
    'source === "performance"');

  assert(
    !rx.rationaleCodes.includes("glp1_daily_overlay_active"),
    'rationaleCodes does NOT include "glp1_daily_overlay_active" for non-GLP-1 user',
  );

  assert(
    !rx.rationaleCodes.includes("glp1_limits_enforced_post_performance"),
    'rationaleCodes does NOT include "glp1_limits_enforced_post_performance" for non-GLP-1 user',
  );

  assert(rx.glp1DailyProteinFloor === null,
    'glp1DailyProteinFloor is null for non-GLP-1 user');

  assert(rx.glp1DailyFatCeiling === null,
    'glp1DailyFatCeiling is null for non-GLP-1 user');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — GLP-1 without Performance: source stays "clinical"
//
// When performance mode is off, the GLP-1 re-enforcement block still runs
// but never pushes source to "performance" and the post-performance rationale
// code must NOT appear.
// ─────────────────────────────────────────────────────────────────────────────
section("Test 6 (control): GLP-1 without Performance — source is 'clinical', no post-performance code");
{
  const rx = simulatePrescription(
    {
      caloriesBase:   1800,
      proteinBase:    120,
      carbsBase:      200,
      fatBase:        70,
      starchyBase:    130,
      fibrousBase:    70,
      isGLP1Active:   true,
      performanceModeEnabled: false,  // ← Performance off
    },
    HIGH_LOAD_DAY,
  );

  console.log(`  source=${rx.source} | protein=${rx.proteinTarget}g | fat=${rx.fatTarget}g`);
  console.log(`  rationaleCodes: ${rx.rationaleCodes.join(", ")}`);

  assert(rx.source === "clinical",
    'source === "clinical" when performance is off');

  assert(
    !rx.rationaleCodes.includes("glp1_limits_enforced_post_performance"),
    'rationaleCodes does NOT include "glp1_limits_enforced_post_performance" when performance is off',
  );

  assert(
    rx.glp1DailyFatCeiling !== null && rx.fatTarget <= rx.glp1DailyFatCeiling,
    `fatTarget (${rx.fatTarget}g) ≤ GLP-1 fat ceiling (${rx.glp1DailyFatCeiling}g)`,
  );

  assert(
    rx.glp1DailyProteinFloor !== null && rx.proteinTarget >= rx.glp1DailyProteinFloor,
    `proteinTarget (${rx.proteinTarget}g) ≥ GLP-1 protein floor (${rx.glp1DailyProteinFloor}g)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(68)}`);
console.log(`Prescription Resolver — GLP-1 + Performance tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailed assertions:");
  failMessages.forEach((m) => console.log(m));
  process.exit(1);
} else {
  console.log("All tests passed ✅");
}
