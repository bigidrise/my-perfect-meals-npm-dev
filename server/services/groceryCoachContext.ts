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
  buildSavedGroceriesPromptBlock,
  selectAuthoritativelyApprovedSavedItems,
} from "./savedGroceryCompliance";
import { revalidateSavedGroceriesForUser } from "./savedGroceryRevalidation";
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
  /** Rows that passed protocol compliance filtering (subset of savedRows) —
   * the only rows eligible to be surfaced as a "usual pick". */
  compliantSavedRows: SavedGroceryRow[];

  // Derived convenience flags
  isClinical: boolean;
  hasDiabetes: boolean;
}

export async function buildGroceryCoachContext(userId: string): Promise<GroceryCoachContext> {
  // ── Protocol envelope ───────────────────────────────────────────────────────
  const loadedEnvelope = await loadUserProtocolEnvelope(userId).catch(() => null);
  const envelopeFailed = loadedEnvelope === null;
  const envelope = loadedEnvelope ?? buildGuestEnvelope();
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
  let compliantSavedRows: SavedGroceryRow[] = [];

  try {
    const sgRows = await db
      .select()
      .from(userSavedGroceryItems)
      .where(eq(userSavedGroceryItems.userId, userId));

    savedRows = sgRows.map((r) => ({
      productName:  r.productName,
      brand:        r.brand,
      category:     r.category,
      nutritionJson: r.nutritionJson,
    }));

    if (sgRows.length > 0) {
      // Never apply the guest fallback to saved favorites. If the context
      // resolvers failed, inject none; otherwise use the exact same current-
      // profile revalidation contract as the Saved Groceries API.
      const authoritativeContextResolved = !envelopeFailed && !glp1Failed;
      const decisions = authoritativeContextResolved
        ? await revalidateSavedGroceriesForUser(userId, sgRows)
        : [];
      const compliant = selectAuthoritativelyApprovedSavedItems(
        sgRows,
        decisions,
        authoritativeContextResolved,
      );
      savedGroceriesBlock = buildSavedGroceriesPromptBlock(compliant);
      compliantSavedRows = compliant.map((r) => ({
        productName:  r.productName ?? null,
        brand:        r.brand ?? null,
        category:     r.category ?? null,
        nutritionJson: r.nutritionJson ?? null,
      }));
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
    compliantSavedRows,
    isClinical: glp1Targets !== null || (envelope.hasDiabetes ?? false),
    hasDiabetes: envelope.hasDiabetes ?? false,
  };
}
