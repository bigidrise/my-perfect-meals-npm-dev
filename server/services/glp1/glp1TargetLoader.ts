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
 *
 * @param userId  String user ID (UUID or numeric string).
 *   NOTE: users.id and glp1_profile.user_id are TEXT/varchar columns.
 *   Never pass Number(userId) — UUID strings coerce to NaN and match nothing.
 */
export async function loadGLP1ResolvedTargets(
  userId: string,
  options: LoadOptions
): Promise<ResolvedGLP1Targets> {
  // ── 1. Load user macro targets ───────────────────────────────────────────
  let userContext: GLP1UserContext = {
    activeConstraints: options.activeConstraints ?? [],
    appetiteLevel: options.appetiteLevel ?? 'normal',
    trainingDemand: options.trainingDemand ?? 'none',
    musclePreservationPriority: options.musclePreservationPriority ?? false,
  };

  // ── DB errors propagate rather than falling back to defaults ───────────────
  // When a DB failure occurs, the resolver (resolveGLP1GlobalContext) catches the
  // thrown error and returns null, which triggers the fail-closed isActive+noTargets
  // → 503 check at every generation route. Swallowing DB errors here would let an
  // active GLP-1 patient proceed with generic static baselines instead of their
  // patient-specific targets — a clinical safety risk.
  const userResult = await db.execute(
    sql`SELECT daily_calorie_target, daily_protein_target, daily_fat_target, daily_carbs_target
        FROM users WHERE id = ${userId} LIMIT 1`
  );
  const userRows = userResult.rows as Array<{
    daily_calorie_target: number | null;
    daily_protein_target: number | null;
    daily_fat_target: number | null;
    daily_carbs_target: number | null;
  }>;

  if (userRows.length > 0) {
    const u = userRows[0];
    userContext = {
      ...userContext,
      dailyCalorieTarget: u.daily_calorie_target ?? undefined,
      dailyProteinTarget: u.daily_protein_target ?? undefined,
      dailyFatTarget: u.daily_fat_target ?? undefined,
      dailyCarbsTarget: u.daily_carbs_target ?? undefined,
      macroMealsPerDay: undefined,
    };
  }

  // ── 2. Load GLP-1 guardrails ─────────────────────────────────────────────
  // Guardrails failure propagates too — we can't safely resolve targets without them.
  const profileResult = await db.execute(
    sql`SELECT guardrails FROM glp1_profile WHERE user_id = ${userId}`
  );
  const profileRow = profileResult.rows?.[0] as { guardrails?: unknown } | undefined;
  // guardrails row may not exist yet (user pre-dates glp1_profile setup) — use defaults.
  userContext.glp1Guardrails = (profileRow?.guardrails as GLP1Guardrails) ?? DEFAULT_GLP1_GUARDRAILS;

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
