/**
 * Shared Grocery Coach decision context.
 *
 * Single source of truth for protocol envelope, GLP-1 targets, macro targets,
 * and saved grocery compliance. Both /recommend and /swap-ingredient call
 * buildGroceryCoachContext() — edit here to update both routes simultaneously.
 */

import { db } from "../db";
import { users, userSavedGroceryItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  loadUserProtocolEnvelope,
  enforceBeforeGenerate,
  buildGuestEnvelope,
} from "./protocolEnvelope";
import {
  resolveGLP1GlobalContext,
  buildGLP1RecommendationBlock,
} from "./glp1/resolveGLP1GlobalContext";
import {
  filterSavedGroceriesForCompliance,
  buildSavedGroceriesPromptBlock,
} from "./savedGroceryCompliance";
import type { ResolvedGLP1Targets } from "./glp1/resolveGLP1MealTargets";

// The raw saved row shape returned alongside the prompt block so callers can
// do per-item nutrition validation (e.g. GLP-1 fat ceiling on savedOption).
export interface SavedGroceryRow {
  productName: string | null;
  brand: string | null;
  category: string | null;
  nutritionJson: unknown;
}

export interface GroceryCoachContext {
  // Protocol
  envelope: ReturnType<typeof buildGuestEnvelope>;
  protocolContext: string;

  // GLP-1
  /** true if resolveGLP1GlobalContext threw / returned null — callers decide how to handle */
  glp1Failed: boolean;
  /** true if the user has GLP-1 active (regardless of whether targets resolved) */
  glp1Active: boolean;
  glp1Targets: ResolvedGLP1Targets | null;
  glp1RecommendationBlock: string;

  // Macros
  macroContext: string;
  /** Raw targets for diabetic carb-ceiling math */
  dailyCarbsTarget: number | null;

  // Saved groceries
  /** Prompt block with compliant saved items (empty string = none) */
  savedGroceriesBlock: string;
  /** Raw rows for per-item nutrition validation */
  savedRows: SavedGroceryRow[];

  // Derived convenience flags
  isClinical: boolean;
  hasDiabetes: boolean;
}

export async function buildGroceryCoachContext(userId: string): Promise<GroceryCoachContext> {
  // ── Protocol envelope ───────────────────────────────────────────────────────
  const envelope =
    (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope();
  const protocolContext = enforceBeforeGenerate(envelope, {
    generatorName: "grocery_coach",
  }).combined;

  // ── GLP-1 context ───────────────────────────────────────────────────────────
  const todayISO = new Date().toISOString().slice(0, 10);
  const rawGlp1 = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);

  const glp1Failed  = rawGlp1 === null;
  const glp1Active  = rawGlp1?.isActive ?? false;
  const glp1Targets = rawGlp1?.isActive && rawGlp1.resolvedTargets
    ? rawGlp1.resolvedTargets
    : null;
  const glp1RecommendationBlock = rawGlp1 ? buildGLP1RecommendationBlock(rawGlp1) : "";

  // ── Macro targets ───────────────────────────────────────────────────────────
  let macroContext   = "";
  let dailyCarbsTarget: number | null = null;

  try {
    const [userRow] = await db
      .select({
        dailyCalorieTarget: users.dailyCalorieTarget,
        dailyProteinTarget: users.dailyProteinTarget,
        dailyFatTarget:     users.dailyFatTarget,
        dailyCarbsTarget:   users.dailyCarbsTarget,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow?.dailyCalorieTarget) {
      const parts = [`${userRow.dailyCalorieTarget} cal/day`];
      if (userRow.dailyProteinTarget) parts.push(`${userRow.dailyProteinTarget}g protein`);
      if (userRow.dailyFatTarget)     parts.push(`${userRow.dailyFatTarget}g fat`);
      if (userRow.dailyCarbsTarget)   parts.push(`${userRow.dailyCarbsTarget}g carbs`);
      macroContext = `Daily macro targets: ${parts.join(", ")}`;
    }
    dailyCarbsTarget = userRow?.dailyCarbsTarget ?? null;
  } catch {
    /* non-fatal */
  }

  // ── Saved groceries ─────────────────────────────────────────────────────────
  let savedGroceriesBlock = "";
  let savedRows: SavedGroceryRow[] = [];

  try {
    const sgRows = await db
      .select({
        id:           userSavedGroceryItems.id,
        productName:  userSavedGroceryItems.productName,
        brand:        userSavedGroceryItems.brand,
        category:     userSavedGroceryItems.category,
        productKey:   userSavedGroceryItems.productKey,
        nutritionJson: userSavedGroceryItems.nutritionJson,
        productMeta:  userSavedGroceryItems.productMeta,
        savedAt:      userSavedGroceryItems.savedAt,
      })
      .from(userSavedGroceryItems)
      .where(eq(userSavedGroceryItems.userId, userId));

    savedRows = sgRows.map((r) => ({
      productName:  r.productName,
      brand:        r.brand,
      category:     r.category,
      nutritionJson: r.nutritionJson,
    }));

    if (sgRows.length > 0) {
      const diabeticCarbCeiling: number | null = envelope.hasDiabetes
        ? (dailyCarbsTarget && dailyCarbsTarget > 0
            ? Math.round(dailyCarbsTarget / 3)
            : 45)
        : null;

      const itemsWithIngredients = sgRows.map((row) => {
        const meta = (row as any).productMeta as Record<string, unknown> | null;
        const ingredients = Array.isArray(meta?.ingredients)
          ? (meta!.ingredients as string[]).filter((i) => typeof i === "string")
          : null;
        return { ...row, ingredients };
      });

      const { compliant } = filterSavedGroceriesForCompliance(
        itemsWithIngredients as any,
        envelope,
        {
          glp1Targets,
          isDiabetic: envelope.hasDiabetes,
          diabeticCarbCeiling,
        },
      );
      savedGroceriesBlock = buildSavedGroceriesPromptBlock(compliant);
      if (compliant.length > 0) {
        console.log(
          `[GroceryCoachContext] ${compliant.length} saved grocery favorites loaded for user ${userId}`,
        );
      }
    }
  } catch (sgErr: any) {
    console.warn("[GroceryCoachContext] Could not load saved groceries:", sgErr?.message);
  }

  return {
    envelope,
    protocolContext,
    glp1Failed,
    glp1Active,
    glp1Targets,
    glp1RecommendationBlock,
    macroContext,
    dailyCarbsTarget,
    savedGroceriesBlock,
    savedRows,
    isClinical: glp1Targets !== null || (envelope.hasDiabetes ?? false),
    hasDiabetes: envelope.hasDiabetes ?? false,
  };
}
