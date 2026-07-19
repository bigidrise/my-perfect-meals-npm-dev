/**
 * Daily Nutrition State Engine
 *
 * Resolves a user's current daily nutrition state from their weekly training schedule,
 * macro targets, and today's confirmed consumption. This is the authoritative source
 * for day-specific carbohydrate rules that every recommendation surface must consult.
 *
 * Design contract:
 *   - Only confirmed consumption (macro_logs entries) reduces the daily budget.
 *   - Browsing, generating, saving, or scheduling a meal does NOT reduce the budget.
 *   - When ledger data is unreliable, the system never claims the budget is exhausted.
 *   - null preGenerationConstraint = no active constraint; generators may proceed freely.
 *   - This service is protocol-neutral: performance is the first use case, but the
 *     same infrastructure will eventually govern diabetic, GLP-1, renal, and other protocols.
 */

import { db } from "../db";
import { macroLogs } from "../../shared/schema";
import { sql } from "drizzle-orm";
import {
  resolveTodayTargets,
  SessionType,
  WeeklyTrainingSchedule,
  PerformanceProtocolConfig,
  MacroBaseline,
} from "./protocol/performanceProtocolResolver";

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
}

const FIBROUS_FREE = "broccoli, spinach, zucchini, cauliflower, kale, peppers, asparagus, cucumbers, leafy greens";

function deriveStarchPolicy(
  sessionType: SessionType | null,
  targetG: number,
  remainingG: number,
  budgetExhausted: boolean,
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
  const base = SESSION_POLICIES[sessionType];

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

  const sessionTitle = sessionLabel?.toUpperCase() ?? sessionType.toUpperCase();
  const target  = Math.round(starchyCarbsTargetG);
  const consumed = Math.round(starchyCarbsConsumedG);
  const remaining = Math.round(starchyCarbsRemainingG);

  const consumedNote =
    consumed > 0 && ledgerReliability !== "low"
      ? ` The user has already consumed approximately ${consumed}g of starchy carbohydrates today.`
      : "";

  const fibFree = `Fibrous vegetables (${FIBROUS_FREE}) are unrestricted and should be included generously.`;

  if (starchyBudgetExhausted && ledgerReliability !== "low") {
    return (
      `🗓️ PERFORMANCE SCHEDULE — ${sessionTitle} (TODAY):\n` +
      `STARCH BUDGET EXHAUSTED: The user has consumed ${consumed}g of starchy carbohydrates today ` +
      `(daily target: ${target}g). Do NOT include additional starchy carbohydrate sources in this recommendation.\n` +
      `Excluded sources: rice, pasta, bread, tortillas, potatoes, oats, corn, beans, grains, cereal.\n` +
      `${fibFree}`
    );
  }

  if (sessionType === "off") {
    const targetLine =
      target < 30
        ? `STARCH TARGET: ${target}g (minimal — rest day). Exclude or strictly minimize all starchy carbohydrate sources.`
        : `STARCH TARGET: ${target}g (reduced — rest day). Minimize starchy carbohydrates; lean protein and fibrous vegetables are the priority.`;
    return (
      `🗓️ PERFORMANCE SCHEDULE — ${sessionTitle} (TODAY):\n` +
      `${targetLine}${consumedNote}\n` +
      `${fibFree}`
    );
  }

  if (sessionType === "recovery") {
    return (
      `🗓️ PERFORMANCE SCHEDULE — ${sessionTitle} (TODAY):\n` +
      `STARCH TARGET: ${target}g total today (${remaining}g remaining).${consumedNote}\n` +
      `Anti-inflammatory foods are prioritized: omega-3 sources, colorful vegetables, turmeric, ginger. ` +
      `Starchy carbohydrates are permitted at the stated allocation — keep portions moderate.\n` +
      `${fibFree}`
    );
  }

  return (
    `🗓️ PERFORMANCE SCHEDULE — ${sessionTitle} (TODAY):\n` +
    `STARCH TARGET: ${target}g total today (${remaining}g remaining).${consumedNote}\n` +
    `Include a meaningful starchy carbohydrate source to support training. ` +
    `Preferred sources: sweet potato, brown rice, oats, whole grain bread, quinoa.\n` +
    `${fibFree}`
  );
}

/**
 * Resolve the user's current daily nutrition state.
 *
 * Accepts pre-fetched user data (from the protocol envelope DB select) to avoid
 * a second round-trip to the users table. Only queries macro_logs for today's
 * confirmed consumption, which is new data not available at envelope-load time.
 *
 * IMPORTANT: Only confirmed macro_logs entries count as consumption.
 * Generated, saved, or scheduled meals are NOT deducted.
 */
export async function resolveDailyNutritionState(
  input: DailyStateInput,
): Promise<DailyNutritionState> {
  const now = input.now ?? new Date();
  const timezone = input.timezone || "America/Chicago";

  const resolvedAt = now.toISOString();
  const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);

  const base: Omit<DailyNutritionState, "starchPolicy" | "preGenerationConstraint"> = {
    userId:              input.userId,
    resolvedAt,
    localDate:           localDateStr,
    timezone,
    performanceActive:   input.performanceActive,
    scheduleConfigured:  false,
    sessionType:         null,
    sessionLabel:        null,
    trainingPhase:       null,
    starchyCarbsTargetG: input.baseline.starchyCarbsG,
    fibrousCarbsTargetG: input.baseline.fibrousCarbsG,
    totalCarbsTargetG:   input.baseline.carbsG,
    starchyCarbsConsumedG: 0,
    totalCarbsConsumedG:   0,
    starchyCarbsRemainingG: input.baseline.starchyCarbsG,
    starchyBudgetExhausted: false,
    ledgerReliability:   "low",
  };

  if (!input.performanceActive || !input.schedule || !input.config) {
    return {
      ...base,
      starchPolicy:            "unlimited",
      preGenerationConstraint: null,
    };
  }

  const resolved = resolveTodayTargets(input.schedule, input.config, input.baseline, now);

  const logStart = new Date(now);
  logStart.setHours(0, 0, 0, 0);
  const logEnd = new Date(now);
  logEnd.setHours(23, 59, 59, 999);

  const [logged] = await db
    .select({
      starchyCarbsG:  sql<number>`COALESCE(SUM(${macroLogs.starchyCarbs}::numeric), 0)`,
      fibrousCarbsG:  sql<number>`COALESCE(SUM(${macroLogs.fibrousCarbs}::numeric), 0)`,
      totalCarbsG:    sql<number>`COALESCE(SUM(${macroLogs.carbs}::numeric), 0)`,
      rowCount:       sql<number>`COUNT(*)`,
      nonZeroStarchy: sql<number>`COUNT(*) FILTER (WHERE ${macroLogs.starchyCarbs}::numeric > 0)`,
    })
    .from(macroLogs)
    .where(
      sql`${macroLogs.userId} = ${input.userId}
        AND ${macroLogs.at} >= ${logStart.toISOString()}
        AND ${macroLogs.at} <= ${logEnd.toISOString()}`
    );

  const rowCount       = Number(logged?.rowCount ?? 0);
  const nonZeroStarchy = Number(logged?.nonZeroStarchy ?? 0);
  const consumedStarchy = Number(logged?.starchyCarbsG ?? 0);
  const consumedTotal   = Number(logged?.totalCarbsG ?? 0);

  let ledgerReliability: LedgerReliability = "low";
  if (rowCount === 0) {
    ledgerReliability = "high";
  } else if (nonZeroStarchy === rowCount) {
    ledgerReliability = "high";
  } else if (nonZeroStarchy > 0) {
    ledgerReliability = "medium";
  }

  const targetStarchy   = resolved.starchyCarbsG;
  const remaining       = Math.max(0, targetStarchy - consumedStarchy);
  const budgetExhausted = ledgerReliability !== "low" && consumedStarchy >= targetStarchy;

  const state: DailyNutritionState = {
    userId:                 input.userId,
    resolvedAt,
    localDate:              localDateStr,
    timezone,
    performanceActive:      true,
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
    starchPolicy:           "unlimited",
    preGenerationConstraint: null,
  };

  state.starchPolicy = deriveStarchPolicy(
    state.sessionType,
    state.starchyCarbsTargetG,
    state.starchyCarbsRemainingG,
    state.starchyBudgetExhausted,
    state.ledgerReliability,
  );

  state.preGenerationConstraint = buildPreGenerationConstraint(state);

  return state;
}
