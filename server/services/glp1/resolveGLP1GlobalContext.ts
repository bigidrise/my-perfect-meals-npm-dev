/**
 * resolveGLP1GlobalContext — Canonical GLP-1 context resolver
 *
 * Single source of truth for whether a user is on GLP-1 and what the
 * approved constraints are for any given date. Consumed by every food-
 * generating and food-recommending surface so the user experiences one
 * consistent GLP-1 intelligence layer, not per-feature recreations.
 *
 * ACTIVATION: GLP-1 is active when ANY of these current-state sources is true —
 *   • users.selectedMealBuilder === "glp1"         (user's currently selected builder)
 *   • users.medicalConditions contains "glp1"      (physician-managed: PUT /api/pro/glp1-protocol/:id)
 *   • users.specialtyConditions contains a GLP-1 keyword (updateable specialty overlay)
 *
 * INTENTIONALLY EXCLUDED as activation sources:
 *   • users.preferredBuilder — "starting recommendation from onboarding" (schema comment),
 *     NOT a current treatment indicator; could be stale from initial setup
 *   • glp1_profile row exists — table has no is_active field; a row persists forever
 *     after GLP-1 setup completes with no deactivation mechanism
 *
 * FUTURE: Add users.glp1_protocol_active boolean (canonical single flag).
 *   The three sources above establish/migrate that state, but every feature should
 *   eventually ask one question: "Is this person's GLP-1 protocol currently active?"
 *
 * GLP-1 + PERFORMANCE COMPOSITION:
 *   When Performance is also active (users.performanceModeEnabled), the
 *   resolved training-day prescription drives macro targets for the day,
 *   and GLP-1 volume/tolerance constraints remain layered on top.
 *   Do NOT relax GLP-1 food-quality or portion rules based on Performance context.
 *
 * MACRO CALCULATOR BASELINE:
 *   This resolver produces meal-level constraints only.
 *   The Macro Calculator baseline is NOT altered by GLP-1.
 *
 * VOLUME/PORTION STRATEGY:
 *   Do not hard-code a universal percentage reduction here. Use the
 *   governed rules from resolveGLP1MealTargets (resolver registry) which
 *   applies phase/appetite/training multipliers correctly. Any new volume
 *   rules belong in that registry, not scattered through feature code.
 */

import { db } from "../../db";
import { users } from "../../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { loadGLP1ResolvedTargets } from "./glp1TargetLoader";
import type { ResolvedGLP1Targets } from "./resolveGLP1MealTargets";
import { resolveDailyNutritionState } from "../nutritionStateService";
import type { DailyNutritionState } from "../../../shared/dailyNutritionPrescription";

// ─── GLP-1 activation keyword sets ──────────────────────────────────────────
// Must match a condition array entry containing any of these substrings
// (case-insensitive) to count as GLP-1 active from that source.
const GLP1_CONDITION_KEYS = [
  "glp1", "glp-1", "glp 1",
  "semaglutide", "tirzepatide", "ozempic", "wegovy", "mounjaro",
  "rybelsus", "liraglutide", "dulaglutide", "exenatide", "trulicity",
  "victoza", "saxenda", "zepbound",
];

function arrayIncludesGLP1(arr: unknown): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.some(
    (v) =>
      typeof v === "string" &&
      GLP1_CONDITION_KEYS.some((k) => v.toLowerCase().includes(k)),
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type GLP1ActivationSource =
  | "selectedMealBuilder"
  | "medicalConditions"
  | "specialtyConditions";

export interface GLP1GlobalContext {
  /** True when GLP-1 is active from ANY detection source. */
  isActive: boolean;

  /** Every source that contributed to activation — used for diagnostics. */
  activationSources: GLP1ActivationSource[];

  /** Is Performance mode also active today? */
  performanceActive: boolean;

  /**
   * Patient-specific resolved meal targets from resolveGLP1MealTargets.
   * null when the resolver could not load (treats as baseline — graceful degradation).
   *
   * Pass this to applyGuardrails() and validateMealForDiet() so the AI
   * and validator use personalized protein/fat/calorie constraints instead
   * of the static 400 kcal / 12 g fat / 15 g protein defaults.
   */
  resolvedTargets: ResolvedGLP1Targets | null;

  /** Today's remaining nutrition state — for remaining-budget guidance. */
  dailyNutritionState: DailyNutritionState | null;

  /**
   * Composition note for GLP-1 + Performance.
   * Inject into prompts that need to explain the interaction.
   * Empty string when Performance is not also active.
   */
  compositionNote: string;
}

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Resolve the canonical GLP-1 context for a user on a given date.
 * Safe to call from any food-generating or food-recommending surface.
 *
 * Returns isActive=false quickly when GLP-1 is not detected so callers
 * can gate downstream calls behind that check.
 *
 * @param userId    Authenticated user ID (string from authUser.id)
 * @param dateISO   Target date in YYYY-MM-DD format (usually today)
 * @param mealType  Meal slot being generated (drives resolver's per-meal targets)
 */
export async function resolveGLP1GlobalContext(
  userId: string,
  dateISO: string,
  mealType: "breakfast" | "lunch" | "dinner" | "snack" = "lunch",
): Promise<GLP1GlobalContext> {
  // ── 1. Load user row ─────────────────────────────────────────────────────
  let userRow: any = null;
  try {
    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    userRow = found ?? null;
  } catch (err) {
    console.warn("[GLP1Context] Could not load user row:", err);
  }

  // ── 2. Detect activation from every possible source ──────────────────────
  const activationSources: GLP1ActivationSource[] = [];

  if (userRow) {
    // Source 1: currently selected builder — user actively controls this
    if (userRow.selectedMealBuilder === "glp1") {
      activationSources.push("selectedMealBuilder");
    }
    // Source 2: physician-managed clinical assignment
    // PUT /api/pro/glp1-protocol/:clientId {enabled:true/false} adds/removes "glp1"
    // from this array — the canonical clinical toggle for GLP-1 activation/deactivation
    if (arrayIncludesGLP1(userRow.medicalConditions)) {
      activationSources.push("medicalConditions");
    }
    // Source 3: specialty conditions overlay (updateable; GLP-1 keywords valid here)
    if (arrayIncludesGLP1(userRow.specialtyConditions)) {
      activationSources.push("specialtyConditions");
    }
    // NOT CHECKED: preferredBuilder — onboarding recommendation, not current treatment state
    // NOT CHECKED: glp1_profile row — no is_active field; persists forever after setup
  }

  const isActive = activationSources.length > 0;

  // ── 3. Performance mode detection ────────────────────────────────────────
  const performanceActive = Boolean(userRow?.performanceModeEnabled);

  // ── 4. GLP-1 + Performance composition note ──────────────────────────────
  const compositionNote =
    isActive && performanceActive
      ? "GLP-1 + Performance COMPOSITION: training-day prescription controls macro targets for this day. " +
        "GLP-1 volume/tolerance constraints (small portions, low fat, easy digestion, protein priority) " +
        "remain FULLY ACTIVE on top of the performance prescription. " +
        "Do NOT relax GLP-1 food-quality rules based on performance context."
      : "";

  // ── 5. Early exit when GLP-1 is not active ───────────────────────────────
  if (!isActive) {
    return {
      isActive: false,
      activationSources: [],
      performanceActive,
      resolvedTargets: null,
      dailyNutritionState: null,
      compositionNote: "",
    };
  }

  // ── 6. Load resolved targets + DailyNutritionState in parallel ───────────
  const [firstPassTargets, dailyNutritionState] = await Promise.all([
    (async (): Promise<ResolvedGLP1Targets | null> => {
      try {
        return await loadGLP1ResolvedTargets(userId, { mealType });
      } catch (err) {
        console.warn("[GLP1Context] Initial target resolution failed — using static baselines:", err);
        return null;
      }
    })(),
    (async (): Promise<DailyNutritionState | null> => {
      try {
        return await resolveDailyNutritionState(userId, dateISO);
      } catch (err) {
        console.warn("[GLP1Context] DailyNutritionState unavailable:", err);
        return null;
      }
    })(),
  ]);

  // ── 7. Second-pass resolution with actual remaining macros ────────────────
  // When DailyNutritionState is available, pass remaining macros back through
  // the resolver so it produces budget-aware per-meal targets rather than
  // simple daily-average splits.
  let resolvedTargets = firstPassTargets;
  if (firstPassTargets && dailyNutritionState) {
    try {
      resolvedTargets = await loadGLP1ResolvedTargets(userId, {
        mealType,
        remainingMacros: {
          calories: dailyNutritionState.remaining.calories,
          protein:  dailyNutritionState.remaining.protein,
          fat:      dailyNutritionState.remaining.fat,
          carbs:    dailyNutritionState.remaining.carbs,
        },
      });
    } catch {
      // First pass already succeeded — keep it
    }
  }

  console.log(
    `[GLP1Context] user=${userId} date=${dateISO} meal=${mealType} ` +
    `active=true sources=[${activationSources.join(",")}] ` +
    `performance=${performanceActive} ` +
    `targets=${
      resolvedTargets
        ? `${resolvedTargets.resolvedMealCalories}kcal / ` +
          `${resolvedTargets.targetProteinGrams}g prot / ` +
          `${resolvedTargets.maximumToleratedFatGrams}g fat-ceiling ` +
          `[phase: ${resolvedTargets.treatmentPhase}] ` +
          `[baseline: ${resolvedTargets.usedBaseline}]`
        : "STATIC BASELINE (resolver unavailable)"
    }`,
  );

  return {
    isActive,
    activationSources,
    performanceActive,
    resolvedTargets,
    dailyNutritionState,
    compositionNote,
  };
}

// ─── Recommendation-surface prompt block ─────────────────────────────────────

/**
 * Build a GLP-1 guidance block appropriate for recommendation surfaces
 * (restaurants, getaways, buffets, meal finder, grocery coach).
 *
 * Recommendation surfaces cannot enforce portion sizes but CAN guide:
 *   - Food selection (protein priority, lower-fat preparation)
 *   - Eating strategy (stop at comfortable fullness, avoid heavy items)
 *   - Side choices (non-starchy vegetables over fries/rice)
 *
 * Returns an empty string when GLP-1 is not active so callers can safely
 * append it without an extra isActive check.
 */
export function buildGLP1RecommendationBlock(ctx: GLP1GlobalContext): string {
  if (!ctx.isActive) return "";

  const t = ctx.resolvedTargets;
  const phase = t?.treatmentPhase ?? "active";
  const proteinTarget = t?.targetProteinGrams ?? 15;
  const fatCeiling = t?.maximumToleratedFatGrams ?? 12;
  const calTarget = t?.resolvedMealCalories ?? 400;

  const lines: string[] = [
    `GLP-1 MEDICATION PROTOCOL — ACTIVE (sources: ${ctx.activationSources.join(", ")})`,
    `Treatment phase: ${phase} | Meal target: ~${calTarget} kcal | Protein: ≥${proteinTarget}g | Fat ceiling: ≤${fatCeiling}g`,
    "",
    "FOOD SELECTION RULES for this GLP-1 patient (recommendation surface — you cannot control exact serving sizes, so guide CHOICES and PREPARATION):",
    `• PROTEIN FIRST: Always lead recommendations with the highest-protein option available. Target ≥${proteinTarget}g protein.`,
    `• FAT CEILING: Avoid fried foods, heavy cream sauces, buttery preparations, and high-fat cheeses. Favor preparations ≤${fatCeiling}g fat.`,
    "• PREPARATION: Prefer grilled, baked, steamed, or roasted. Avoid breaded, fried, or sauce-heavy dishes.",
    "• STARCH STRATEGY: Recommend skipping or reducing starchy sides (fries, rice, bun, bread). Suggest vegetables or salad instead.",
    "• PORTION AWARENESS: Note that GLP-1 medications reduce appetite — smaller portions are appropriate. Do NOT encourage large plates or 'hearty' meals.",
    "• AVOID: Heavy appetizers, creamy soups, sugary drinks, desserts, high-fat entrees.",
  ];

  if (ctx.compositionNote) {
    lines.push("", ctx.compositionNote);
  }

  return lines.join("\n");
}
