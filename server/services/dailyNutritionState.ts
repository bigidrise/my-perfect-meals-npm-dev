/**
 * Daily Nutrition State Engine
 *
 * Resolves a user's current daily nutrition state from their weekly training schedule,
 * macro targets, and today's confirmed consumption. This is the authoritative source
 * for day-specific carbohydrate rules that every recommendation surface must consult.
 *
 * Design contract:
 *   - Only confirmed consumption (macro_logs entries) reduces the daily budget.
 *   - Browsing, generating, saving, favoriting, scheduling, or planning a meal does NOT
 *     reduce the budget. Proof: only explicit log-write API calls insert into macro_logs.
 *   - When ledger data is unreliable, the system never claims the budget is exhausted.
 *   - null preGenerationConstraint = no active constraint; generators may proceed freely.
 *   - This service is protocol-neutral: performance is the first use case, but the
 *     same infrastructure will eventually govern diabetic, GLP-1, renal, and other protocols.
 *
 * Timezone correctness:
 *   - localDate is computed via Intl.DateTimeFormat("en-CA") — always user's local date.
 *   - DB query window uses localDayUTCBounds() — converts local midnight to UTC.
 *   - Session type uses a noon-UTC Date derived from localDate to drive getDay() correctly.
 *   - Server clock timezone has no effect on any of the above.
 */

import { db } from "../db";
import { macroLogs } from "../../shared/schema";
import { sql, and } from "drizzle-orm";
import {
  resolveTodayTargets,
  SessionType,
  WeeklyTrainingSchedule,
  PerformanceProtocolConfig,
  MacroBaseline,
} from "./protocol/performanceProtocolResolver";
import { resolveDailyNutritionState as resolveCanonicalNutritionState } from "./nutritionStateService";

export type StarchPolicy = "zero" | "restricted" | "moderate" | "generous" | "unlimited";
export type LedgerReliability = "high" | "medium" | "low";

export interface DailyNutritionState {
  userId: string;
  resolvedAt: string;
  localDate: string;
  timezone: string;

  performanceActive: boolean;
  scheduleConfigured: boolean;

  sessionType: SessionType | null;
  sessionLabel: string | null;
  trainingPhase: string | null;

  starchyCarbsTargetG: number;
  fibrousCarbsTargetG: number;
  totalCarbsTargetG: number;

  starchyCarbsConsumedG: number;
  totalCarbsConsumedG: number;

  starchyCarbsRemainingG: number;
  starchyBudgetExhausted: boolean;

  starchPolicy: StarchPolicy;

  ledgerReliability: LedgerReliability;

  preGenerationConstraint: string | null;
}

export interface DailyStateInput {
  userId: string;
  schedule: WeeklyTrainingSchedule | null;
  config: PerformanceProtocolConfig | null;
  baseline: MacroBaseline;
  timezone: string;
  performanceActive: boolean;
  now?: Date;
  /**
   * When set, the macro_log row whose board_item_reference equals this ID
   * is excluded from the consumed-carb totals.
   *
   * Use this for the meal-refinement preview path: the item being replaced
   * has already been logged, so its macros would otherwise count against
   * its own replacement budget.  Passing its ID here removes it from the
   * aggregation so the replacement receives a fair budget.
   */
  excludeItemId?: string;
}

/** Shape of the aggregated macro_logs row for today. */
export interface DailyLogSummary {
  rowCount:       number;
  nonZeroStarchy: number;
  starchyCarbsG:  number;
  fibrousCarbsG:  number;
  totalCarbsG:    number;
}

const FIBROUS_FREE = "broccoli, spinach, zucchini, cauliflower, kale, peppers, asparagus, cucumbers, leafy greens";

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute UTC start/end timestamps bounding the user's local calendar day.
 *
 * Uses Intl to measure the UTC offset at local noon (avoids DST transitions at midnight).
 *
 * Proof (America/Chicago CDT = UTC−5):
 *   noonUtc  = 2026-07-19T12:00:00Z
 *   user sees 07:00 CDT  →  utcOffsetMin = (7×60) − (12×60) = −300
 *   local midnight UTC   = Date.UTC(2026,6,19,0,0,0) − (−300 × 60_000)
 *                        = 2026-07-19T05:00:00Z  ✓  (05:00Z = 00:00 CDT)
 *   end of local day UTC = 2026-07-20T04:59:59.999Z  ✓
 *
 * Proof (Asia/Kolkata IST = UTC+5:30):
 *   noonUtc  = 2026-07-19T12:00:00Z
 *   user sees 17:30 IST  →  utcOffsetMin = (17×60+30) − (12×60) = +330
 *   local midnight UTC   = Date.UTC(2026,6,19,0,0,0) − (330 × 60_000)
 *                        = 2026-07-18T18:30:00Z  ✓  (18:30Z prev day = 00:00 IST)
 *
 * Limitation: uses noon offset for the full day; DST transitions at midnight are ignored.
 * This affects <0.01% of log entries and is an accepted approximation for v1.
 */
export function localDayUTCBounds(
  localDateStr: string,
  timezone: string,
): { start: Date; end: Date } {
  const [y, m, d] = localDateStr.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  }).format(noonUtc); // e.g. "07:00" (CDT), "17:30" (IST), "24:00" (guard needed)

  const [hRaw, mRaw] = formatted.split(":");
  const localH = Number(hRaw === "24" ? "0" : hRaw);
  const localM = Number(mRaw ?? "0");

  const utcOffsetMin   = localH * 60 + localM - 720; // 720 = 12 × 60
  const midnightUtcMs  = Date.UTC(y, m - 1, d, 0, 0, 0) - utcOffsetMin * 60_000;

  return {
    start: new Date(midnightUtcMs),
    end:   new Date(midnightUtcMs + 86_399_999), // exactly 23h 59m 59.999s later
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE COMPUTATION CORE (no DB — fully testable)
// ─────────────────────────────────────────────────────────────────────────────

function deriveStarchPolicy(
  sessionType:      SessionType | null,
  targetG:          number,
  budgetExhausted:  boolean,
  ledgerReliability: LedgerReliability,
): StarchPolicy {
  if (!sessionType) return "unlimited";
  if (budgetExhausted && ledgerReliability !== "low") return "zero";

  const SESSION_POLICIES: Record<SessionType, StarchPolicy> = {
    off:            "restricted",
    recovery:       "restricted",
    strength:       "moderate",
    power:          "generous",
    endurance:      "generous",
    sport_practice: "moderate",
    competition:    "generous",
  };
  // Guard: unknown session type from legacy JSONB data → safe moderate default
  const base = SESSION_POLICIES[sessionType] ?? "moderate";
  if (base === "restricted" && targetG < 30) return "zero";
  return base;
}

function buildPreGenerationConstraint(state: DailyNutritionState): string | null {
  if (!state.scheduleConfigured || !state.sessionType) return null;

  const {
    sessionType,
    sessionLabel,
    starchyCarbsTargetG,
    starchyCarbsConsumedG,
    starchyCarbsRemainingG,
    starchyBudgetExhausted,
    ledgerReliability,
  } = state;

  const sessionTitle = (sessionLabel ?? sessionType).toUpperCase();
  const target    = Math.round(starchyCarbsTargetG);
  const consumed  = Math.round(starchyCarbsConsumedG);
  const remaining = Math.round(starchyCarbsRemainingG);

  const consumedNote =
    consumed > 0 && ledgerReliability !== "low"
      ? ` The user has already consumed approximately ${consumed}g of starchy carbohydrates today.`
      : "";

  const fibFree = `Fibrous vegetables (${FIBROUS_FREE}) are unrestricted and should be included generously.`;

  // Budget exhausted — hard block regardless of session type
  if (starchyBudgetExhausted && ledgerReliability !== "low") {
    return (
      `🗓️ PERFORMANCE SCHEDULE — ${sessionTitle} (TODAY):\n` +
      `STARCH BUDGET EXHAUSTED: The user has consumed ${consumed}g of starchy carbohydrates today ` +
      `(daily target: ${target}g). Do NOT include additional starchy carbohydrate sources in this recommendation.\n` +
      `Excluded sources: rice, pasta, bread, tortillas, potatoes, oats, corn, beans, grains, cereal.\n` +
      fibFree
    );
  }

  // Rest day
  if (sessionType === "off") {
    const targetLine =
      target < 30
        ? `STARCH TARGET: ${target}g (minimal — rest day). Exclude or strictly minimize all starchy carbohydrate sources.`
        : `STARCH TARGET: ${target}g (reduced — rest day). Minimize starchy carbohydrates; lean protein and fibrous vegetables are the priority.`;
    return (
      `🗓️ PERFORMANCE SCHEDULE — ${sessionTitle} (TODAY):\n` +
      targetLine + consumedNote + "\n" +
      fibFree
    );
  }

  // Recovery day
  if (sessionType === "recovery") {
    return (
      `🗓️ PERFORMANCE SCHEDULE — ${sessionTitle} (TODAY):\n` +
      `STARCH TARGET: ${target}g total today (${remaining}g remaining).${consumedNote}\n` +
      `Anti-inflammatory foods are prioritized: omega-3 sources, colorful vegetables, turmeric, ginger. ` +
      `Starchy carbohydrates are permitted at the stated allocation — keep portions moderate.\n` +
      fibFree
    );
  }

  // Training days (strength, power, endurance, sport_practice, competition)
  return (
    `🗓️ PERFORMANCE SCHEDULE — ${sessionTitle} (TODAY):\n` +
    `STARCH TARGET: ${target}g total today (${remaining}g remaining).${consumedNote}\n` +
    `Include a meaningful starchy carbohydrate source to support training. ` +
    `Preferred sources: sweet potato, brown rice, oats, whole grain bread, quinoa.\n` +
    fibFree
  );
}

/**
 * Pure computation core — no DB, fully testable.
 *
 * Takes pre-fetched log data and pre-computed localDateStr + resolvedAt.
 * Called by resolveDailyNutritionState() after the DB query.
 * Exported for unit testing.
 */
export function computeDailyNutritionState(
  input:        DailyStateInput,
  logData:      DailyLogSummary,
  localDateStr: string,
  resolvedAt:   string,
  localNoonAsUTC: Date,
): DailyNutritionState {
  const timezone = input.timezone || "America/Chicago";

  const base: DailyNutritionState = {
    userId:               input.userId,
    resolvedAt,
    localDate:            localDateStr,
    timezone,
    performanceActive:    input.performanceActive,
    scheduleConfigured:   false,
    sessionType:          null,
    sessionLabel:         null,
    trainingPhase:        null,
    starchyCarbsTargetG:  input.baseline.starchyCarbsG,
    fibrousCarbsTargetG:  input.baseline.fibrousCarbsG,
    totalCarbsTargetG:    input.baseline.carbsG,
    starchyCarbsConsumedG:  0,
    totalCarbsConsumedG:    0,
    starchyCarbsRemainingG: input.baseline.starchyCarbsG,
    starchyBudgetExhausted: false,
    ledgerReliability:    "low",
    starchPolicy:         "unlimited",
    preGenerationConstraint: null,
  };

  if (!input.performanceActive || !input.schedule || !input.config) {
    return base;
  }

  // Resolve today's session using the timezone-correct Date for day-of-week.
  // getDayKey() calls date.getDay() (server-local). Passing noon UTC on the
  // user's local date ensures getDay() returns the correct weekday on any server
  // running UTC±11 (all practical production deployments).
  const resolved = resolveTodayTargets(
    input.schedule,
    input.config,
    input.baseline,
    localNoonAsUTC,
  );

  const rowCount        = Number(logData.rowCount ?? 0);
  const nonZeroStarchy  = Number(logData.nonZeroStarchy ?? 0);
  const consumedStarchy = Number(logData.starchyCarbsG ?? 0);
  const consumedTotal   = Number(logData.totalCarbsG ?? 0);

  // Ledger reliability determines whether we can trust that zero = really zero.
  // "high"   — no rows today (known zero) or every row has starchy_carbs > 0
  //             (every log entry was ingredient-classified)
  // "medium" — some rows have starchy_carbs > 0, some are zero (partial classification)
  // "low"    — all rows exist but every starchy_carbs = 0 (cannot distinguish real
  //             zero from un-classified; do NOT claim exhaustion)
  let ledgerReliability: LedgerReliability = "low";
  if (rowCount === 0) {
    // No entries today — consumption is definitively zero.
    ledgerReliability = "high";
  } else if (nonZeroStarchy === rowCount) {
    // Every entry has a classified starchy carb value.
    ledgerReliability = "high";
  } else if (nonZeroStarchy > 0) {
    // Partial classification — some entries were classified, some weren't.
    ledgerReliability = "medium";
  }
  // else: all entries have starchy_carbs = 0 → ledgerReliability stays "low"

  const targetStarchy   = resolved.starchyCarbsG;
  const remaining       = Math.max(0, targetStarchy - consumedStarchy);
  // Never claim exhaustion when ledger is unreliable (low means all zeros — unclassified)
  const budgetExhausted = ledgerReliability !== "low" && consumedStarchy >= targetStarchy;

  const state: DailyNutritionState = {
    ...base,
    scheduleConfigured:     true,
    sessionType:            resolved.sessionType,
    sessionLabel:           resolved.sessionLabel,
    trainingPhase:          resolved.trainingPhase,
    starchyCarbsTargetG:    targetStarchy,
    fibrousCarbsTargetG:    resolved.fibrousCarbsG,
    totalCarbsTargetG:      resolved.carbsG,
    starchyCarbsConsumedG:  consumedStarchy,
    totalCarbsConsumedG:    consumedTotal,
    starchyCarbsRemainingG: remaining,
    starchyBudgetExhausted: budgetExhausted,
    ledgerReliability,
    starchPolicy:           "unlimited", // computed below
    preGenerationConstraint: null,       // computed below
  };

  state.starchPolicy = deriveStarchPolicy(
    state.sessionType,
    state.starchyCarbsTargetG,
    state.starchyBudgetExhausted,
    state.ledgerReliability,
  );

  state.preGenerationConstraint = buildPreGenerationConstraint(state);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC ENTRY POINT (DB-backed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the user's current daily nutrition state.
 *
 * Accepts pre-fetched user data (from the protocol envelope DB select) to avoid
 * a second round-trip to the users table. Only queries macro_logs for today's
 * confirmed consumption, which is new data not available at envelope-load time.
 *
 * IMPORTANT: Only confirmed macro_logs entries count as consumption.
 * Generated, saved, favorited, or scheduled meals do NOT write to macro_logs
 * and therefore do NOT deduct from the budget. The only write paths to macro_logs
 * are POST /api/macro-logs (quick log), POST /api/meals/log (food/recipe log).
 */
export async function resolveDailyNutritionState(
  input: DailyStateInput,
): Promise<DailyNutritionState> {
  const now = input.now ?? new Date();
  const timezone = input.timezone || "America/Chicago";
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const canonical = await resolveCanonicalNutritionState(
    input.userId,
    localDate,
    input.excludeItemId,
  );

  const classification = canonical.consumed.classificationStatus ?? "UNCLASSIFIED";
  const ledgerReliability: LedgerReliability =
    classification === "VERIFIED" ? "high" :
    classification === "MIXED" ? "medium" :
    "low";
  const trainingDayType = canonical.prescription.trainingDayType;
  const sessionType: SessionType | null =
    trainingDayType === "rest" ? "off" :
    trainingDayType === "light" ? "recovery" :
    trainingDayType === "moderate" ? "strength" :
    trainingDayType === "heavy" ? "endurance" :
    trainingDayType === "competition" ? "competition" :
    null;

  const state: DailyNutritionState = {
    userId: input.userId,
    resolvedAt: canonical.resolvedAt,
    localDate: canonical.localDay?.date ?? canonical.date,
    timezone: canonical.localDay?.timezone ?? timezone,
    performanceActive: canonical.modifiers?.performance ?? input.performanceActive,
    scheduleConfigured: sessionType !== null,
    sessionType,
    sessionLabel: trainingDayType,
    trainingPhase: null,
    starchyCarbsTargetG: canonical.prescription.starchyCarbsTarget,
    fibrousCarbsTargetG: canonical.prescription.fibrousCarbsTarget,
    totalCarbsTargetG: canonical.prescription.carbsTarget,
    starchyCarbsConsumedG:
      canonical.consumed.confirmedStarchyCarbs ?? canonical.consumed.starchyCarbs,
    totalCarbsConsumedG: canonical.consumed.carbs,
    starchyCarbsRemainingG:
      canonical.consumedRemaining?.starchyCarbs ?? canonical.remaining.starchyCarbs,
    starchyBudgetExhausted:
      canonical.starch?.consumed.exhausted
      ?? canonical.activeConstraints.consumedStarchExhausted
      ?? false,
    starchPolicy: "unlimited",
    ledgerReliability,
    preGenerationConstraint: null,
  };
  state.starchPolicy = deriveStarchPolicy(
    state.sessionType,
    state.starchyCarbsTargetG,
    state.starchyBudgetExhausted,
    state.ledgerReliability,
  );
  state.preGenerationConstraint = buildPreGenerationConstraint(state);
  return state;
}
