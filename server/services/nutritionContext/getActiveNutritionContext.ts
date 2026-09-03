/**
 * server/services/nutritionContext/getActiveNutritionContext.ts
 *
 * Unified Active Nutrition Context — thin wrapper over the existing
 * protocol envelope system.  Does NOT modify loadUserProtocolEnvelope.
 *
 * Merges:
 *   - Dietary identity  (from protocol envelope)
 *   - Medical conditions (from protocol envelope)
 *   - Allergies         (from protocol envelope)
 *   - Active builder    (selectedMealBuilder from users table)
 *
 * Returns a single context object that every feature can consume.
 * Routes adopt this gradually — it is purely additive.
 */

import {
  loadUserProtocolEnvelope,
  enforceBeforeGenerate,
  buildGuestEnvelope,
  UserProtocolEnvelope,
} from "../protocolEnvelope";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BuilderKey =
  | "weekly"
  | "diabetic"
  | "glp1"
  | "anti_inflammatory"
  | "beach_body"
  | "general_nutrition"
  | "performance_competition"
  | null;

export interface BuilderGuidance {
  carbStrategy?: "low_glycemic" | "moderate" | "performance";
  inflammationFocus?: boolean;
  sodiumRestriction?: boolean;
  potassiumRestriction?: boolean;
  proteinModeration?: boolean;
  proteinPriority?: boolean;
  sugarControl?: boolean;
  portionControl?: boolean;
  alcoholGuidance?: "limit_or_avoid" | "avoid_completely";
  generalTone: "strict" | "balanced" | "supportive" | "performance";
}

export interface ActiveNutritionContext {
  userId: string;

  /** Dietary identity pulled from the protocol envelope */
  diet: string[];

  /** Medical hard limits + optimization tags from protocol envelope */
  medical: string[];

  /** Absolute allergy blocks from protocol envelope */
  allergies: string[];

  /** The user's currently selected meal builder, or null */
  builder: BuilderKey;

  /** Structured guidance derived from builder selection */
  guidance: BuilderGuidance;

  /**
   * Ready-to-inject prompt blocks.
   * protocolBlock  = diet + allergies + medical (from enforceBeforeGenerate)
   * builderBlock   = additive builder-specific rules text
   * combinedBlock  = protocolBlock + builderBlock (use this for most routes)
   */
  protocolBlock: string;
  builderBlock: string;
  combinedBlock: string;

  /** Raw protocol envelope — available for scanGeneratedOutput or direct use */
  envelope: UserProtocolEnvelope;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder → Guidance mapping
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_GUIDANCE: BuilderGuidance = {
  generalTone: "balanced",
};

const BUILDER_GUIDANCE_MAP: Record<string, BuilderGuidance> = {
  weekly: {
    generalTone: "balanced",
  },

  diabetic: {
    carbStrategy: "low_glycemic",
    sugarControl: true,
    portionControl: true,
    generalTone: "strict",
  },

  anti_inflammatory: {
    inflammationFocus: true,
    generalTone: "balanced",
  },

  glp1: {
    portionControl: true,
    proteinPriority: true,
    sugarControl: true,
    alcoholGuidance: "limit_or_avoid",
    generalTone: "supportive",
  },

  beach_body: {
    carbStrategy: "moderate",
    proteinPriority: true,
    sugarControl: true,
    generalTone: "balanced",
  },

  general_nutrition: {
    generalTone: "balanced",
  },

  performance_competition: {
    carbStrategy: "performance",
    proteinPriority: true,
    generalTone: "performance",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Builder → additive prompt text
// ─────────────────────────────────────────────────────────────────────────────

function buildBuilderPromptBlock(builder: BuilderKey, guidance: BuilderGuidance): string {
  if (!builder || builder === "weekly" || builder === "general_nutrition") return "";

  const lines: string[] = [
    `ACTIVE NUTRITION BUILDER: ${builder.toUpperCase().replace(/_/g, " ")}`,
    `The following rules apply in addition to all dietary and medical constraints above:`,
  ];

  if (guidance.carbStrategy === "low_glycemic") {
    lines.push(`- CARBOHYDRATE STRATEGY: Prioritize low-glycemic carbs only (GI < 55)`);
    lines.push(`- Avoid white rice, white bread, refined flour, added sugar, fruit juice`);
    lines.push(`- Prefer: legumes, non-starchy vegetables, whole grains, sweet potato`);
  }

  if (guidance.carbStrategy === "moderate") {
    lines.push(`- CARBOHYDRATE STRATEGY: Moderate, balanced carb intake — whole food sources only`);
    lines.push(`- Avoid highly processed carbs and added sugar`);
  }

  if (guidance.carbStrategy === "performance") {
    lines.push(`- CARBOHYDRATE STRATEGY: Performance fueling — complex carbs timed around activity`);
    lines.push(`- Prioritize glycogen-replenishing foods; avoid empty simple sugars`);
  }

  if (guidance.sugarControl) {
    lines.push(`- SUGAR: No added sugar. Natural fruit sugars in moderation only`);
    lines.push(`- Use natural sweeteners (stevia, monk fruit) as substitutes when needed`);
  }

  if (guidance.inflammationFocus) {
    lines.push(`- INFLAMMATION: Prioritize anti-inflammatory ingredients`);
    lines.push(`- Preferred: fatty fish, olive oil, berries, leafy greens, turmeric, ginger, walnuts`);
    lines.push(`- Avoid: processed oils (seed/vegetable oil), refined carbs, processed meats, excess dairy`);
  }

  if (guidance.sodiumRestriction) {
    lines.push(`- SODIUM: Strictly limit. Use herbs and spices for flavor — no added salt`);
    lines.push(`- Avoid: canned foods with added sodium, processed meats, salty sauces, pickled items`);
  }

  if (guidance.potassiumRestriction) {
    lines.push(`- POTASSIUM: Avoid high-potassium foods (bananas, potatoes, tomatoes, oranges, avocados)`);
    lines.push(`- Use low-potassium alternatives: apples, berries, cabbage, white rice`);
  }

  if (guidance.proteinModeration) {
    lines.push(`- PROTEIN: Moderate portions — avoid excessive protein which stresses the kidneys`);
    lines.push(`- Max protein per serving: 20–25g. Prefer plant-based protein sources`);
  }

  if (guidance.proteinPriority) {
    lines.push(`- PROTEIN: Prioritize high-quality protein in every meal`);
    lines.push(`- Target: 25–40g protein per serving. Lean meats, eggs, legumes, fish, Greek yogurt`);
  }

  if (guidance.portionControl) {
    lines.push(`- PORTIONS: Keep portions controlled and precise. Avoid large-volume meals`);
  }

  if (guidance.alcoholGuidance === "limit_or_avoid") {
    lines.push(`- ALCOHOL: Avoid alcoholic beverages or limit to one serving maximum. Prefer non-alcoholic alternatives`);
  }

  if (guidance.alcoholGuidance === "avoid_completely") {
    lines.push(`- ALCOHOL: Do NOT include any alcohol or alcohol-based ingredients`);
  }

  const toneMap: Record<BuilderGuidance["generalTone"], string> = {
    strict: "Apply all rules strictly — do not relax constraints even for special occasions",
    balanced: "Apply rules firmly but allow natural, whole-food flexibility",
    supportive: "Apply rules with a supportive, encouraging tone — frame restrictions as helpful guidance",
    performance: "Optimize for performance and recovery — prioritize macros and energy availability",
  };

  lines.push(`- ENFORCEMENT TONE: ${toneMap[guidance.generalTone]}`);

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the unified Active Nutrition Context for a user.
 *
 * Always safe to call — falls back to guest envelope + no builder on any error.
 * Never throws.
 */
export async function getActiveNutritionContext(
  userId: string | null | undefined,
): Promise<ActiveNutritionContext> {
  const isGuest = !userId || userId === "1";

  // ── 1. Load protocol envelope (existing system — untouched) ────────────────
  const envelope: UserProtocolEnvelope = isGuest
    ? buildGuestEnvelope()
    : (await loadUserProtocolEnvelope(userId!).catch(() => null)) ?? buildGuestEnvelope();

  // ── 2. Derive protocol prompt block ───────────────────────────────────────
  const protocolBlock = enforceBeforeGenerate(envelope, {
    generatorName: "active_nutrition_context",
  }).combined;

  // ── 3. Read selectedMealBuilder from DB ────────────────────────────────────
  let builder: BuilderKey = null;

  if (!isGuest) {
    try {
      const [user] = await db
        .select({ selectedMealBuilder: users.selectedMealBuilder })
        .from(users)
        .where(eq(users.id, userId!))
        .limit(1);

      const raw = user?.selectedMealBuilder ?? null;
      builder = (raw as BuilderKey) ?? null;
    } catch {
      // Non-fatal — proceed without builder context
    }
  }

  // ── 4. Map builder → guidance ──────────────────────────────────────────────
  const guidance: BuilderGuidance =
    (builder && BUILDER_GUIDANCE_MAP[builder]) ?? DEFAULT_GUIDANCE;

  // ── 5. Build additive builder block ───────────────────────────────────────
  const builderBlock = buildBuilderPromptBlock(builder, guidance);

  // ── 6. Assemble combined block ─────────────────────────────────────────────
  const combinedBlock = [protocolBlock, builderBlock].filter(Boolean).join("\n\n");

  return {
    userId: userId ?? "guest",
    diet: envelope.dietaryIdentity,
    medical: [
      ...envelope.medicalHardLimits,
      ...envelope.medicalOptimization,
    ],
    allergies: envelope.allergies,
    builder,
    guidance,
    protocolBlock,
    builderBlock,
    combinedBlock,
    envelope,
  };
}
