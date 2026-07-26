/**
 * glp1TargetLoader — async DB loader for the GLP-1 resolver
 *
 * Fetches the user record and glp1_profile.guardrails from the database,
 * then calls resolveGLP1MealTargets() to produce a deterministic
 * ResolvedGLP1Targets object suitable for prompt and validator injection.
 *
 * Call this at the route or service level where userId and mealType are known,
 * then pass the result to applyGuardrails() and validateMealForDiet().
 */

import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '@shared/schema';
import { DEFAULT_GLP1_GUARDRAILS } from '../../../shared/glp1-schema';
import type { GLP1Guardrails } from '../../../shared/glp1-schema';
import {
  resolveGLP1MealTargets,
  type GLP1UserContext,
  type GLP1MealContext,
  type ResolvedGLP1Targets,
  type AppetiteLevel,
  type TrainingDemand,
} from './resolveGLP1MealTargets';
import { eq } from 'drizzle-orm';

interface LoadOptions {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  remainingMacros?: {
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
  };
  mealsCompletedToday?: number;
  activeConstraints?: string[];
  appetiteLevel?: AppetiteLevel;
  trainingDemand?: TrainingDemand;
  musclePreservationPriority?: boolean;
}

/**
 * Load the user's macro targets and GLP-1 guardrails from the DB,
 * then resolve patient-specific meal targets.
 *
 * Returns resolved targets or falls back to baseline if the user record
 * is not found or does not have targets set.
 */
export async function loadGLP1ResolvedTargets(
  userId: number,
  options: LoadOptions
): Promise<ResolvedGLP1Targets> {
  // ── 1. Load user macro targets ───────────────────────────────────────────
  let userContext: GLP1UserContext = {
    activeConstraints: options.activeConstraints ?? [],
    appetiteLevel: options.appetiteLevel ?? 'normal',
    trainingDemand: options.trainingDemand ?? 'none',
    musclePreservationPriority: options.musclePreservationPriority ?? false,
  };

  try {
    const userRows = await db
      .select({
        dailyCalorieTarget: users.dailyCalorieTarget,
        dailyProteinTarget: users.dailyProteinTarget,
        dailyFatTarget: users.dailyFatTarget,
        dailyCarbsTarget: users.dailyCarbsTarget,
        macroMealsPerDay: (users as any).macroMealsPerDay,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length > 0) {
      const u = userRows[0];
      userContext = {
        ...userContext,
        dailyCalorieTarget: u.dailyCalorieTarget ?? undefined,
        dailyProteinTarget: u.dailyProteinTarget ?? undefined,
        dailyFatTarget: u.dailyFatTarget ?? undefined,
        dailyCarbsTarget: u.dailyCarbsTarget ?? undefined,
        macroMealsPerDay: u.macroMealsPerDay ?? undefined,
      };
    }
  } catch (err) {
    console.warn('[glp1TargetLoader] Failed to load user macro targets — using baselines', err);
  }

  // ── 2. Load GLP-1 guardrails ─────────────────────────────────────────────
  try {
    const profileResult = await db.execute(
      sql`SELECT guardrails FROM glp1_profile WHERE user_id = ${userId}`
    );
    const profileRow = profileResult.rows?.[0] as { guardrails?: unknown } | undefined;
    const guardrails = (profileRow?.guardrails as GLP1Guardrails) ?? DEFAULT_GLP1_GUARDRAILS;
    userContext.glp1Guardrails = guardrails;
  } catch (err) {
    console.warn('[glp1TargetLoader] Failed to load glp1_profile guardrails — using defaults', err);
    userContext.glp1Guardrails = DEFAULT_GLP1_GUARDRAILS;
  }

  // ── 3. Resolve ───────────────────────────────────────────────────────────
  const mealContext: GLP1MealContext = {
    mealType: options.mealType,
    remainingMacros: options.remainingMacros,
    mealsCompletedToday: options.mealsCompletedToday,
  };

  const resolved = resolveGLP1MealTargets(userContext, mealContext);

  console.log(
    `[GLP-1 Resolver] user=${userId} meal=${options.mealType} ` +
    `cal=${resolved.resolvedMealCalories} protein=${resolved.targetProteinGrams}g ` +
    `fat-ceiling=${resolved.maximumToleratedFatGrams}g phase=${resolved.treatmentPhase} ` +
    `baseline=${resolved.usedBaseline}`
  );

  return resolved;
}
