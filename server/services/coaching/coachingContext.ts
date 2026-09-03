/**
 * MPM Coaching Context Service — Phase 1 (Coaching Intelligence Layer)
 *
 * Builds a CoachingContextSnapshot: the canonical factual record for one coaching turn.
 *
 * ARCHITECTURE CONTRACT:
 *   MPM data → CoachingContextSnapshot → observers/reasoning → specialization → response
 *
 * Every important field carries an explicit status envelope:
 *   { value, status: 'observed'|'zero'|'missing'|'not_applicable', source, sourceType, observedAt }
 *
 * This allows the engine — and the LLM — to distinguish:
 *   - observed:        we have data and it is non-zero
 *   - zero:            we have data and the value is legitimately zero
 *   - missing:         no data was found (null in DB, no rows)
 *   - not_applicable:  this field does not apply to this user/specialization
 *
 * DESIGN RULES:
 * 1. This service is the single database query for coaching context. Observers do NOT
 *    re-query the same tables — they receive the snapshot and compute findings from it.
 *    (Observer migration to consume the snapshot is a Phase 2 concern; Phase 1 wires
 *    it into the adapter/engine prompt layer.)
 * 2. today.meals.completeness is NEVER guessed from meal count alone. It defaults to
 *    'unknown' and only upgrades with corroborating evidence (time of day + 7d average).
 * 3. clinical context is gated by permittedClinicalScopes — the caller declares what
 *    the specialization is allowed to see. Never return clinical data speculatively.
 * 4. sleep is intentionally omitted. MPM removed sleep from Today's Check-In.
 *    If a future data source provides sleep data, add it explicitly with a new field.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import {
  getCapabilitiesForUser,
  formatCapabilitiesForPrompt,
  type CapabilityScope,
} from "./capabilityRegistry";
import type { CoachingContextSnapshot, FieldValue, DataConfidence } from "../../../shared/coaching/types";
import { resolveHydrationDay } from "../hydration/hydrationDay";

// ─── Helper: build a FieldValue ───────────────────────────────────────────────

function observed<T>(
  value: T,
  source: string,
  sourceType?: string,
  observedAt?: Date
): FieldValue<T> {
  return {
    value,
    status: "observed",
    source,
    sourceType,
    observedAt: observedAt ?? new Date(),
  };
}

function zero<T>(
  value: T,
  source: string
): FieldValue<T> {
  return { value, status: "zero", source };
}

function missing<T = number>(source: string): FieldValue<T> {
  return { value: null, status: "missing", source } as FieldValue<T>;
}

function notApplicable<T = number>(): FieldValue<T> {
  return { value: null, status: "not_applicable" } as FieldValue<T>;
}

// ─── Data Confidence Classifier ───────────────────────────────────────────────

function classifyDataConfidence(snapshot: {
  prescriptionObserved: boolean;
  todayMacrosObserved: boolean;
  todayCheckinObserved: boolean;
  todayMealsObserved: boolean;
}): DataConfidence {
  const { prescriptionObserved, todayMacrosObserved, todayCheckinObserved, todayMealsObserved } = snapshot;

  const observedCount = [
    prescriptionObserved,
    todayMacrosObserved,
    todayCheckinObserved,
    todayMealsObserved,
  ].filter(Boolean).length;

  // HIGH: prescription + today's macros (the two most important signals)
  if (prescriptionObserved && todayMacrosObserved) return "HIGH";
  // PARTIAL: at least 2 of the 4 signals present
  if (observedCount >= 2) return "PARTIAL";
  // LOW: 0 or 1 signal
  return "LOW";
}

// ─── Meal Completeness Estimator ──────────────────────────────────────────────
//
// This function is deliberately conservative. "unknown" is the honest answer
// when we don't have enough evidence. We only upgrade to partial/complete when
// the evidence is unambiguous.
//
// Logic:
//   - 0 meals logged today:  unknown  (they may not have eaten yet, or just haven't logged)
//   - >0 meals AND before noon:  unknown (day hasn't progressed enough to judge)
//   - >0 meals AND after 8pm AND today count < 75% of 7-day average: partial
//   - >0 meals AND after 8pm AND today count >= 7-day average: complete
//   - anything else: unknown

function estimateMealCompleteness(
  todayMealCount: number,
  sevenDayAvgMealsPerLogDay: number | null,
  localHour: number
): "complete" | "partial" | "unknown" {
  if (todayMealCount === 0) return "unknown";
  if (localHour < 12) return "unknown"; // morning — too early to judge
  if (sevenDayAvgMealsPerLogDay === null || sevenDayAvgMealsPerLogDay < 1) return "unknown";

  if (localHour >= 20) {
    // Late evening — now we can reasonably evaluate completeness
    const pct = todayMealCount / sevenDayAvgMealsPerLogDay;
    if (pct >= 1.0) return "complete";
    if (pct < 0.75) return "partial";
  }

  // Afternoon (12–20): only call complete if they're at or above their usual count
  if (localHour >= 12 && localHour < 20) {
    if (todayMealCount >= sevenDayAvgMealsPerLogDay) return "complete";
  }

  return "unknown";
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export interface CoachingContextOptions {
  userId: string;
  /** Coaching specialization requesting this snapshot — controls clinical gating */
  specialization: string;
  /**
   * Which clinical scopes the specialization is permitted to access.
   * cornerAdapter: [] (no clinical access)
   * pregnancyAdapter: ["pregnancy"]
   * glp1Adapter: ["glp1"]
   * procareAdapter: ["clinical"]
   */
  permittedClinicalScopes?: string[];
  /**
   * User's IANA timezone string. Defaults to UTC if not provided.
   * Used to compute local time for meal completeness estimation.
   */
  timezone?: string;
}

export async function buildCoachingContext(
  opts: CoachingContextOptions
): Promise<CoachingContextSnapshot> {
  const { userId, specialization, permittedClinicalScopes = [], timezone = "UTC" } = opts;

  const asOf = new Date();

  // Compute local hour for meal completeness estimation
  let localHour = asOf.getUTCHours();
  try {
    const localTime = new Date(asOf.toLocaleString("en-US", { timeZone: timezone }));
    localHour = localTime.getHours();
  } catch {
    // fallback to UTC
  }

  // ── 1. Profile query ────────────────────────────────────────────────────────
  const profileResult = await db.execute<{
    goal_type: string | null;
    goal_target: string | null;
    dietary_restrictions: string[] | null;
    medical_conditions: string[] | null;
    specialty_conditions: string[] | null;
    activity_level: string | null;
    fitness_goal: string | null;
    performance_mode_enabled: boolean | null;
    timezone: string | null;
  }>(sql`
    SELECT
      goal_type,
      goal_target,
      dietary_restrictions,
      medical_conditions,
      specialty_conditions,
      activity_level,
      fitness_goal,
      performance_mode_enabled,
      timezone
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `);

  const profile = profileResult.rows[0];
  const specialtyConditions: string[] = profile?.specialty_conditions ?? [];
  const effectiveTimezone = profile?.timezone ?? timezone;
  const hydrationDay = await resolveHydrationDay({
    subjectUserId: userId,
    timezone: effectiveTimezone,
    now: asOf,
  });

  // Re-compute local hour with the DB-stored timezone if available
  if (profile?.timezone) {
    try {
      const localTime = new Date(asOf.toLocaleString("en-US", { timeZone: profile.timezone }));
      localHour = localTime.getHours();
    } catch { /* keep previous */ }
  }

  // ── 2. Today's prescription ────────────────────────────────────────────────
  // Primary: daily_nutrition_prescriptions for today
  // (The macro_calculator or performance overlay writes here at resolve time)
  const prescResult = await db.execute<{
    target_calories: string | null;
    target_protein: string | null;
    target_total_carbs: string | null;
    target_starchy_carbs: string | null;
    target_fibrous_carbs: string | null;
    target_fat: string | null;
    source: string | null;
    source_version: string | null;
    performance_day_type: string | null;
    updated_at: Date | null;
  }>(sql`
    SELECT
      target_calories,
      target_protein,
      target_total_carbs,
      target_starchy_carbs,
      target_fibrous_carbs,
      target_fat,
      source,
      source_version,
      performance_day_type,
      updated_at
    FROM daily_nutrition_prescriptions
    WHERE user_id = ${userId}
      AND date = CURRENT_DATE
    LIMIT 1
  `);

  const presc = prescResult.rows[0] ?? null;

  const prescriptionBlock: CoachingContextSnapshot["prescription"] = presc
    ? {
        calories:     presc.target_calories  ? observed(Math.round(parseFloat(presc.target_calories)),  "daily_nutrition_prescriptions", presc.source ?? undefined, presc.updated_at ?? undefined) : missing("daily_nutrition_prescriptions"),
        protein:      presc.target_protein   ? observed(Math.round(parseFloat(presc.target_protein)),   "daily_nutrition_prescriptions", presc.source ?? undefined, presc.updated_at ?? undefined) : missing("daily_nutrition_prescriptions"),
        carbs:        presc.target_total_carbs ? observed(Math.round(parseFloat(presc.target_total_carbs)), "daily_nutrition_prescriptions", presc.source ?? undefined, presc.updated_at ?? undefined) : missing("daily_nutrition_prescriptions"),
        fat:          presc.target_fat       ? observed(Math.round(parseFloat(presc.target_fat)),       "daily_nutrition_prescriptions", presc.source ?? undefined, presc.updated_at ?? undefined) : missing("daily_nutrition_prescriptions"),
        starchyCarbs: presc.target_starchy_carbs ? observed(Math.round(parseFloat(presc.target_starchy_carbs)), "daily_nutrition_prescriptions", presc.source ?? undefined, presc.updated_at ?? undefined) : missing("daily_nutrition_prescriptions"),
        fibrousCarbs: presc.target_fibrous_carbs  ? observed(Math.round(parseFloat(presc.target_fibrous_carbs)),  "daily_nutrition_prescriptions", presc.source ?? undefined, presc.updated_at ?? undefined) : missing("daily_nutrition_prescriptions"),
        source:          presc.source ?? null,
        sourceVersion:   presc.source_version ?? null,
        performanceDayType: presc.performance_day_type ?? null,
        prescribedAt: presc.updated_at ?? null,
      }
    : {
        calories:     missing("daily_nutrition_prescriptions"),
        protein:      missing("daily_nutrition_prescriptions"),
        carbs:        missing("daily_nutrition_prescriptions"),
        fat:          missing("daily_nutrition_prescriptions"),
        starchyCarbs: missing("daily_nutrition_prescriptions"),
        fibrousCarbs: missing("daily_nutrition_prescriptions"),
        source: null,
        sourceVersion: null,
        performanceDayType: null,
        prescribedAt: null,
      };

  // ── 3. Today's macro intake ────────────────────────────────────────────────
  const macroTodayResult = await db.execute<{
    meal_count: string;
    total_kcal: string;
    total_protein: string;
    total_carbs: string;
    total_fat: string;
    total_fiber: string;
    last_logged_at: Date | null;
  }>(sql`
    SELECT
      COUNT(*)::text                   AS meal_count,
      COALESCE(SUM(kcal), 0)::text    AS total_kcal,
      COALESCE(SUM(protein), 0)::text AS total_protein,
      COALESCE(SUM(carbs), 0)::text   AS total_carbs,
      COALESCE(SUM(fat), 0)::text     AS total_fat,
      COALESCE(SUM(fiber), 0)::text   AS total_fiber,
      MAX(at)                          AS last_logged_at
    FROM macro_logs
    WHERE user_id = ${userId}
      AND DATE(at AT TIME ZONE 'UTC') = CURRENT_DATE
  `);

  const mt = macroTodayResult.rows[0];
  const mealCountToday = parseInt(mt?.meal_count ?? "0");
  const hasLogsToday = mealCountToday > 0;

  const makeNutrientField = (rawVal: string | undefined | null, hasLogs: boolean): FieldValue<number> => {
    if (!hasLogs) return missing("macro_logs");
    const v = Math.round(parseFloat(rawVal ?? "0"));
    return v === 0 ? zero(0, "macro_logs") : observed(v, "macro_logs");
  };

  // ── 4. 7-day average meals per log day (for completeness estimation) ───────
  const avg7Result = await db.execute<{ avg_meals_per_day: string }>(sql`
    SELECT
      ROUND(
        COUNT(*)::numeric / NULLIF(COUNT(DISTINCT DATE(at AT TIME ZONE 'UTC')), 0),
        1
      )::text AS avg_meals_per_day
    FROM macro_logs
    WHERE user_id = ${userId}
      AND at >= NOW() - INTERVAL '7 days'
      AND DATE(at AT TIME ZONE 'UTC') != CURRENT_DATE
  `);

  const avg7MealsPerDay: number | null =
    avg7Result.rows[0]?.avg_meals_per_day
      ? parseFloat(avg7Result.rows[0].avg_meals_per_day)
      : null;

  const mealCompleteness = estimateMealCompleteness(mealCountToday, avg7MealsPerDay, localHour);

  // ── 5. Today's hydration ───────────────────────────────────────────────────
  // water_logs stores amount_ml; convert to oz for display (1 ml ≈ 0.0338140 oz)
  const hydrationResult = await db.execute<{
    total_ml: string | null;
    entry_count: string;
  }>(sql`
    SELECT
      COALESCE(SUM(amount_ml), 0)::text AS total_ml,
      COUNT(*)::text                     AS entry_count
    FROM water_logs
    WHERE user_id = ${userId}
      AND intake_time >= ${hydrationDay.start.toISOString()}
      AND intake_time <= ${hydrationDay.end.toISOString()}
  `);

  const hydRow = hydrationResult.rows[0];
  const hydEntries = parseInt(hydRow?.entry_count ?? "0");
  const hydOz = Math.round(parseFloat(hydRow?.total_ml ?? "0") * 0.033814);

  const hydrationOz: FieldValue<number> = hydEntries === 0
    ? missing("water_logs")
    : hydOz === 0
    ? zero(0, "water_logs")
    : observed(hydOz, "water_logs");

  // ── 6. Today's check-in ────────────────────────────────────────────────────
  // NOTE: sleep is intentionally NOT collected here.
  // MPM removed sleep from Today's Check-In. Do not add it.
  const checkinResult = await db.execute<{
    hunger: number | null;
    energy: number | null;
    mood: number | null;
    stress: number | null;
    cravings: number | null;
  }>(sql`
    SELECT hunger, energy, mood, stress, cravings
    FROM ace_daily_checkins
    WHERE user_id = ${userId}
      AND date = CURRENT_DATE
    LIMIT 1
  `);

  const ci = checkinResult.rows[0] ?? null;

  const makeCheckinField = (v: number | null | undefined, fieldName: string): FieldValue<number> => {
    if (ci === null) return missing("ace_daily_checkins");
    if (v === null || v === undefined) return missing(`ace_daily_checkins.${fieldName}`);
    return observed(v, "ace_daily_checkins");
  };

  // ── 7. Overlays ────────────────────────────────────────────────────────────
  const activeOverlays = {
    glp1Active:             specialtyConditions.includes("glp1") || specialtyConditions.includes("glp-1"),
    pregnancyActive:        specialtyConditions.includes("pregnancy-support") || specialization === "pregnancy",
    performanceModeActive:  profile?.performance_mode_enabled === true,
    antiInflammatoryActive: specialtyConditions.includes("anti-inflammatory") || specialtyConditions.includes("anti_inflammatory"),
    diabeticActive:         specialtyConditions.includes("diabetic") || specialtyConditions.includes("diabetes"),
  };

  // ── 8. Capability registry (filtered to user's active scopes) ─────────────
  const activeScopes: CapabilityScope[] = ["all"];
  if (activeOverlays.performanceModeActive) activeScopes.push("performance");
  if (activeOverlays.glp1Active) activeScopes.push("glp1");
  if (activeOverlays.pregnancyActive) activeScopes.push("pregnancy");
  if (activeOverlays.antiInflammatoryActive) activeScopes.push("anti_inflam");
  if (activeOverlays.diabeticActive) activeScopes.push("diabetic");

  const capabilities = getCapabilitiesForUser(activeScopes, true);

  // ── 9. Clinical context (gated by permittedClinicalScopes) ────────────────
  // Phase 1: clinical data returned only when specialization declares it permitted.
  // For cornerAdapter, permittedClinicalScopes = [] → nothing returned.
  // This prevents clinical lab values from leaking into a general coaching prompt.
  let clinicalContext: CoachingContextSnapshot["clinical"] = null;

  if (permittedClinicalScopes.length > 0) {
    // Future: query clinical_labs / clinical_protocol_recommendations filtered by scope
    // For now, acknowledge the gate is in place
    clinicalContext = { permittedScopes: permittedClinicalScopes, data: null };
  }

  // ── 10. Data confidence ───────────────────────────────────────────────────
  const dataConfidence = classifyDataConfidence({
    prescriptionObserved:  presc !== null && presc.target_calories !== null,
    todayMacrosObserved:   hasLogsToday,
    todayCheckinObserved:  ci !== null,
    todayMealsObserved:    hasLogsToday,
  });

  // ── Assemble snapshot ─────────────────────────────────────────────────────
  const snapshot: CoachingContextSnapshot = {
    subject: {
      userId,
      timezone: effectiveTimezone,
      asOf,
      localHour,
    },
    profile: {
      goalType:             profile?.goal_type          ? observed(profile.goal_type, "users") : missing("users"),
      goalTarget:           profile?.goal_target         ? observed(profile.goal_target, "users") : missing("users"),
      dietaryRestrictions:  profile?.dietary_restrictions ?? [],
      medicalConditions:    profile?.medical_conditions  ?? [],
      specialtyConditions,
      activityLevel:        profile?.activity_level       ? observed(profile.activity_level, "users") : missing("users"),
      fitnessGoal:          profile?.fitness_goal          ? observed(profile.fitness_goal, "users") : missing("users"),
    },
    prescription: prescriptionBlock,
    today: {
      localTime: `${localHour}:${String(asOf.getUTCMinutes()).padStart(2, "0")}`,
      macros: {
        calories: makeNutrientField(mt?.total_kcal, hasLogsToday),
        protein:  makeNutrientField(mt?.total_protein, hasLogsToday),
        carbs:    makeNutrientField(mt?.total_carbs, hasLogsToday),
        fat:      makeNutrientField(mt?.total_fat, hasLogsToday),
        fiber:    makeNutrientField(mt?.total_fiber, hasLogsToday),
      },
      meals: {
        count:         hasLogsToday ? observed(mealCountToday, "macro_logs") : missing("macro_logs"),
        completeness:  mealCompleteness,
        lastLoggedAt:  mt?.last_logged_at ?? null,
        avgPerLogDay7: avg7MealsPerDay,
      },
      hydration: {
        oz: hydrationOz,
      },
      checkin: {
        hunger:   makeCheckinField(ci?.hunger,   "hunger"),
        energy:   makeCheckinField(ci?.energy,   "energy"),
        mood:     makeCheckinField(ci?.mood,     "mood"),
        stress:   makeCheckinField(ci?.stress,   "stress"),
        cravings: makeCheckinField(ci?.cravings, "cravings"),
        // sleep intentionally omitted — MPM does not collect sleep in Today's Check-In
      },
    },
    overlays: activeOverlays,
    clinical: clinicalContext,
    dataConfidence,
    capabilities: formatCapabilitiesForPrompt(capabilities),
  };

  return snapshot;
}

/**
 * Renders a CoachingContextSnapshot into a structured text block
 * suitable for injection into a coaching prompt.
 *
 * This replaces the ad-hoc additionalContext JSON dump.
 * The format is designed to be scannable by the LLM while remaining
 * grounded — every field shows its status, so the LLM cannot confuse
 * "missing" with zero.
 */
export function renderSnapshotForPrompt(snapshot: CoachingContextSnapshot): string {
  const { prescription: rx, today, profile, overlays, dataConfidence, capabilities } = snapshot;

  const fv = (field: FieldValue<unknown>): string => {
    if (field.status === "missing") return "MISSING";
    if (field.status === "not_applicable") return "N/A";
    if (field.status === "zero") return "0 (confirmed)";
    return String(field.value ?? "—");
  };

  const lines: string[] = [
    `=== COACHING CONTEXT SNAPSHOT ===`,
    `As of: ${snapshot.subject.asOf.toISOString()} | Local hour: ${snapshot.subject.localHour}:00`,
    `Data confidence: ${dataConfidence}`,
    ``,
    `── PRESCRIPTION (what the user is supposed to eat today) ──`,
    `Calories:     ${fv(rx.calories)} kcal  [source: ${rx.source ?? "unknown"}${rx.performanceDayType ? `, ${rx.performanceDayType} day` : ""}]`,
    `Protein:      ${fv(rx.protein)} g`,
    `Carbs:        ${fv(rx.carbs)} g  (starchy: ${fv(rx.starchyCarbs)} g | fibrous: ${fv(rx.fibrousCarbs)} g)`,
    `Fat:          ${fv(rx.fat)} g`,
    ``,
    `── TODAY'S INTAKE (what the user has actually logged) ──`,
    `Meals logged: ${fv(today.meals.count)}  |  Completeness: ${today.meals.completeness.toUpperCase()}`,
    today.meals.lastLoggedAt ? `Last logged:  ${today.meals.lastLoggedAt.toISOString()}` : `Last logged:  —`,
    `Calories:     ${fv(today.macros.calories)} kcal`,
    `Protein:      ${fv(today.macros.protein)} g`,
    `Carbs:        ${fv(today.macros.carbs)} g`,
    `Fat:          ${fv(today.macros.fat)} g`,
    `Fiber:        ${fv(today.macros.fiber)} g`,
    `Hydration:    ${fv(today.hydration.oz)} oz`,
    ``,
    `── TODAY'S CHECK-IN ──`,
    `Hunger:       ${fv(today.checkin.hunger)}${today.checkin.hunger.status === "observed" ? "/10" : ""}`,
    `Energy:       ${fv(today.checkin.energy)}${today.checkin.energy.status === "observed" ? "/10" : ""}`,
    `Mood:         ${fv(today.checkin.mood)}${today.checkin.mood.status === "observed" ? "/10" : ""}`,
    `Stress:       ${fv(today.checkin.stress)}${today.checkin.stress.status === "observed" ? "/10" : ""}`,
    `Cravings:     ${fv(today.checkin.cravings)}${today.checkin.cravings.status === "observed" ? "/10" : ""}`,
    ``,
    `── USER PROFILE ──`,
    `Goal:         ${fv(profile.goalType)}  (target: ${fv(profile.goalTarget)})`,
    `Activity:     ${fv(profile.activityLevel)}`,
    `Dietary:      ${profile.dietaryRestrictions.length > 0 ? profile.dietaryRestrictions.join(", ") : "none"}`,
    `Medical:      ${profile.medicalConditions.length > 0 ? profile.medicalConditions.join(", ") : "none"}`,
    `Specialty:    ${profile.specialtyConditions.length > 0 ? profile.specialtyConditions.join(", ") : "none"}`,
    ``,
    `── ACTIVE OVERLAYS ──`,
    `Performance:       ${overlays.performanceModeActive ? "ACTIVE" : "inactive"}`,
    `GLP-1:             ${overlays.glp1Active ? "ACTIVE" : "inactive"}`,
    `Pregnancy:         ${overlays.pregnancyActive ? "ACTIVE" : "inactive"}`,
    `Anti-Inflammatory: ${overlays.antiInflammatoryActive ? "ACTIVE" : "inactive"}`,
    `Diabetic:          ${overlays.diabeticActive ? "ACTIVE" : "inactive"}`,
    ``,
    `── AVAILABLE MPM FEATURES ──`,
    `(Recommend a feature ONLY when the user's expressed need matches one of its applicableSituations.)`,
    ...capabilities.map(
      (cap) =>
        `  • ${cap.label} (${cap.id}) → ${cap.route}\n` +
        `    Purpose: ${cap.description}\n` +
        `    Applicable when: ${cap.applicableSituations.join(", ")}`
    ),
    ``,
    `=== END COACHING CONTEXT SNAPSHOT ===`,
  ];

  return lines.join("\n");
}
