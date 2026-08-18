/**
 * server/routes/inspiration-nde-helper.ts
 *
 * Pure helper that computes the NDE summary for the Recipe Maker's
 * "Adapted for today" banner.
 *
 * Extracted from inspiration.ts so the logic can be unit-tested without
 * an HTTP server or database.
 */

import type { UserProtocolEnvelope } from "../services/protocolEnvelope";

export interface NdeSummary {
  scheduleConfigured: boolean;
  starchPolicy: string;
  starchyBudgetExhausted: boolean;
  dayLabel: string | null;
  wasAdapted: boolean;
  adaptedNote: string | null;
  adaptationContext: string[];
}

/**
 * A minimal view of a generated meal — only the nutrition values
 * required to evaluate the starch-restriction gate.
 */
export interface MealCarbView {
  nutrition?: {
    carbs?: number | null;
    carbohydrates?: number | null;
  } | null;
}

/**
 * Compute the NDE summary for a set of generated meals given the user's
 * protocol envelope.
 *
 * Returns null when the envelope produces no useful output (i.e. no
 * scheduleConfigured and wasAdapted=false).
 *
 * This is a pure function — no DB, no network.
 */
export function computeNdeSummary(
  envelope: UserProtocolEnvelope,
  allMeals: MealCarbView[]
): NdeSummary | null {
  // ── Determine which constraints were active during generation ──────
  const activeConstraints: string[] = [];

  // 1. Clinical / specialty conditions — these inject directive blocks
  //    into the generation prompt, so they are true adaptation signals.
  if (envelope.hasDiabetes) {
    activeConstraints.push("diabetes");
  }

  const guidanceBlocks: string[] = envelope.conditionGuidanceBlocks ?? [];
  if (guidanceBlocks.some(b => /glp-?1|semaglutide|ozempic|tirzepatide/i.test(b))) {
    activeConstraints.push("glp1");
  }
  if (guidanceBlocks.some(b => /cardiac|heart/i.test(b))) {
    activeConstraints.push("cardiac");
  }
  if (guidanceBlocks.some(b => /renal|kidney/i.test(b))) {
    activeConstraints.push("renal");
  }
  if (guidanceBlocks.some(b => /oncolog|cancer/i.test(b))) {
    activeConstraints.push("oncology");
  }
  if (guidanceBlocks.some(b => /liver|hepat/i.test(b))) {
    activeConstraints.push("liver");
  }
  if (envelope.hormoneOptimization) {
    activeConstraints.push("hormone");
  }
  if (envelope.pregnancySupport) {
    activeConstraints.push("pregnancy");
  }
  if (envelope.therapeuticSupport) {
    activeConstraints.push("therapeutic");
  }

  // 2. Starch-restriction flags — only count as adaptation when the
  //    generated meals' actual carbs confirm restriction was applied.
  //    A user with an exhausted budget who received 85g-carb recipes
  //    did NOT get an adapted generation.
  const ds = envelope.dailyNutritionState;
  const starchRestricted =
    ds?.scheduleConfigured &&
    (ds.starchPolicy === "zero" || ds.starchyBudgetExhausted);

  if (starchRestricted && activeConstraints.length === 0) {
    // Verify by checking the average carbs across all generated meals.
    // If they genuinely stayed low (< 50 g avg), starch was honoured.
    const mealCarbValues = allMeals
      .map((m) =>
        m.nutrition?.carbs ?? m.nutrition?.carbohydrates ?? null
      )
      .filter((v): v is number => typeof v === "number");

    const avgCarbs =
      mealCarbValues.length > 0
        ? mealCarbValues.reduce((a, b) => a + b, 0) / mealCarbValues.length
        : null;

    if (avgCarbs !== null && avgCarbs < 50) {
      activeConstraints.push("starch-restriction");
    }
  }

  // ── Build wasAdapted + note from active constraints ───────────────
  const wasAdapted = activeConstraints.length > 0;

  let adaptedNote: string | null = null;
  if (wasAdapted) {
    if (activeConstraints.includes("diabetes")) {
      adaptedNote =
        "Adapted for your diabetes management — carbohydrate targets were held within your clinical ceiling.";
    } else if (activeConstraints.includes("glp1")) {
      adaptedNote =
        "Adapted for your GLP-1 medication protocol — portions and composition reflect your tolerance settings.";
    } else if (activeConstraints.includes("cardiac")) {
      adaptedNote =
        "Adapted for your heart-health protocol — saturated fat and sodium targets were applied during generation.";
    } else if (activeConstraints.includes("renal")) {
      adaptedNote =
        "Adapted for your kidney-health protocol — protein and phosphorus limits were applied during generation.";
    } else if (activeConstraints.includes("oncology")) {
      adaptedNote =
        "Adapted for your oncology nutrition protocol — generation followed your clinical dietary guidelines.";
    } else if (activeConstraints.includes("liver")) {
      adaptedNote =
        "Adapted for your liver-health protocol — sodium and fat limits were applied during generation.";
    } else if (activeConstraints.includes("pregnancy")) {
      adaptedNote =
        "Adapted for your pregnancy nutrition protocol — nutrients and safety guidelines were applied.";
    } else if (activeConstraints.includes("hormone")) {
      adaptedNote =
        "Adapted for your hormone optimization protocol — ingredient and macro choices reflect your protocol.";
    } else if (activeConstraints.includes("therapeutic")) {
      adaptedNote =
        "Adapted for your therapeutic nutrition protocol — generation followed your active clinical guidelines.";
    } else if (activeConstraints.includes("starch-restriction")) {
      adaptedNote =
        ds?.starchPolicy === "zero"
          ? "Starchy carbohydrates were minimized — fibrous alternatives were prioritized for today."
          : "Starchy carbohydrate choices were kept within today's remaining budget.";
    }
  }

  if (!(ds?.scheduleConfigured || wasAdapted)) {
    return null;
  }

  return {
    scheduleConfigured: ds?.scheduleConfigured ?? false,
    starchPolicy:       ds?.starchPolicy ?? "any",
    starchyBudgetExhausted: ds?.starchyBudgetExhausted ?? false,
    dayLabel:           (ds as any)?.dayLabel ?? null,
    wasAdapted,
    adaptedNote,
    adaptationContext:  activeConstraints,
  };
}
