/**
 * macroLogService
 *
 * Canonical server-side macro logging service.
 * All "Add to Macros" paths — meal builders, away-from-home, manual entry —
 * write through this single function.
 *
 * Rules enforced here (not in AI prompts, not in routes):
 *   - fibrousCarbs = fiber (derivation is application logic)
 *   - stachyCarbs + fiber ≤ total carbs (silently clamped, not rejected)
 *   - Duplicate-row upsert: same (userId, source, date) accumulates onto existing row
 *   - Calories calculated from macros if not supplied
 */

import { db } from "../db";
import { macroLogs } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { deriveFibrousCarbs } from "../../shared/nutritionFacts";
import { getUserTimezone, todayInTimezone } from "./nutritionDayService";

export interface MacroLogServiceInput {
  userId: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  /** Dietary fiber — used to derive fibrousCarbs when fibrousCarbs is not supplied explicitly */
  fiber?: number | null;
  /** Fibrous carbohydrates (vegetables, leafy greens fraction). When provided, takes priority
   *  over the fiber-derived value so manual entries are stored exactly as the user entered them. */
  fibrousCarbs?: number | null;
  /** Starchy carbohydrates (rice, potato, bread fraction) */
  starchyCarbs?: number | null;
  /**
   * How the starchy/fibrous split was determined. When omitted, derived automatically
   * from which resolution path ran in writeMacroLog:
   *   'ingredient'           — split came from enforceCarbs / ingredient keyword analysis
   *   'user_input'           — caller explicitly provides a known-good split (manual entry)
   *   'conservative_fallback' — no split info available; all carbs treated as starchy
   *   'unclassified'         — legacy / unknown
   */
  classificationSource?: "ingredient" | "user_input" | "conservative_fallback" | "unclassified";
  source: string;
  mealType?: string;
  /** ISO date string YYYY-MM-DD or full ISO timestamp */
  dateIso?: string;
  mealId?: string;
  title?: string;
  /**
   * Stable board item ID (#690 — reservation mechanics).
   * Set when a meal is logged from the board ("Log All") so the nutrition
   * state engine can distinguish planned (on board, not yet logged) from
   * consumed (logged). Null / omitted for manual / quick-log entries.
   */
  boardItemReference?: string | null;
}

function kcalFrom(p = 0, c = 0, f = 0): number {
  return Math.round(p * 4 + c * 4 + f * 9);
}

function parseAt(dateIso?: string): Date {
  if (!dateIso) return new Date();
  // Accept full ISO or date-only; treat date-only as noon UTC to avoid timezone drift
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return new Date(`${dateIso}T12:00:00Z`);
  const d = new Date(dateIso);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function writeMacroLog(input: MacroLogServiceInput) {
  const {
    userId,
    protein,
    carbohydrates,
    fat,
    source,
    dateIso,
    mealId,
  } = input;

  const fiber = input.fiber ?? null;

  // Explicit fibrousCarbs (manual entry) takes priority; fall back to fiber derivation
  // when only fiber is supplied (AI/builder paths that don't split the carb types).
  const fibrousCarbs = input.fibrousCarbs != null
    ? input.fibrousCarbs
    : deriveFibrousCarbs(fiber);

  // Resolve starchyCarbs and classificationSource together.
  //
  // Priority order:
  //   1. Explicit value from caller (including 0 — means genuinely zero starchy carbs).
  //   2. Inferred from fibrousCarbs: starchy = total - fibrous.
  //   3. No split info at all but carbs > 0 → conservative fallback: treat ALL carbs as
  //      starchy. This is the correct product behaviour — we never silently zero-out
  //      starchy carbs just because the caller didn't supply a split.
  //   4. Zero carb meal → starchyCarbs = 0.
  //
  // Callers that have no genuine split should pass null (not 0) so this fallback runs.
  let starchyCarbs: number;
  let derivedClassificationSource: string;

  if (input.starchyCarbs != null) {
    starchyCarbs = input.starchyCarbs;
    derivedClassificationSource = "ingredient"; // caller provided a real split (from enforceCarbs or user entry)
  } else if (fibrousCarbs != null && input.carbohydrates > 0) {
    starchyCarbs = Math.max(0, input.carbohydrates - fibrousCarbs);
    derivedClassificationSource = "ingredient"; // inferred from a known fibrous value
  } else if (input.carbohydrates > 0) {
    starchyCarbs = input.carbohydrates; // no split known — conservative: all carbs are starchy
    derivedClassificationSource = "conservative_fallback";
  } else {
    starchyCarbs = 0;
    derivedClassificationSource = "ingredient";
  }

  // Caller may override the derived source (e.g. manual-entry routes pass 'user_input').
  const classificationSource: string = input.classificationSource ?? derivedClassificationSource;

  const resolvedCalories =
    input.calories > 0
      ? input.calories
      : kcalFrom(protein, carbohydrates, fat);

  const when = parseAt(dateIso);
  const sourceVal = String(source || "manual").slice(0, 24);

  const insertData = {
    userId,
    at: when,
    source: sourceVal,
    kcal: resolvedCalories.toString(),
    protein: (Number(protein) || 0).toString(),
    carbs: (Number(carbohydrates) || 0).toString(),
    fat: (Number(fat) || 0).toString(),
    fiber: fiber != null ? fiber.toString() : "0",
    alcohol: "0",
    starchyCarbs: starchyCarbs != null ? starchyCarbs.toString() : "0",
    fibrousCarbs: fibrousCarbs != null ? fibrousCarbs.toString() : "0",
    classificationSource,
    // boardItemReference links this log entry back to its board item so the
    // nutrition state engine can correctly separate planned from consumed.
    ...(input.boardItemReference ? { boardItemReference: input.boardItemReference } : {}),
  };

  let row: any;
  try {
    [row] = await db.insert(macroLogs).values(insertData).returning();
  } catch (insertErr: any) {
    const isDuplicate = (insertErr?.cause?.code ?? insertErr?.code) === "23505";
    if (!isDuplicate) throw insertErr;

    // Duplicate daily entry — accumulate onto existing row.
    // Match by the owner's local calendar day (not UTC date) so a CDT user
    // adding macros at 11pm doesn't create a new "UTC tomorrow" row.
    const tz = await getUserTimezone(userId);
    const dateStr = dateIso ? dateIso.slice(0, 10) : todayInTimezone(tz);
    const [updated] = await db
      .update(macroLogs)
      .set({
        kcal: sql`${macroLogs.kcal} + ${resolvedCalories}`,
        protein: sql`${macroLogs.protein} + ${Number(protein) || 0}`,
        carbs: sql`${macroLogs.carbs} + ${Number(carbohydrates) || 0}`,
        fat: sql`${macroLogs.fat} + ${Number(fat) || 0}`,
        starchyCarbs: sql`COALESCE(${macroLogs.starchyCarbs}, 0) + ${starchyCarbs ?? 0}`,
        fibrousCarbs: sql`COALESCE(${macroLogs.fibrousCarbs}, 0) + ${fibrousCarbs ?? 0}`,
      })
      .where(
        and(
          eq(macroLogs.userId, userId),
          eq(macroLogs.source, sourceVal),
          sql`(${macroLogs.at} AT TIME ZONE ${tz})::date = ${dateStr}::date`
        )
      )
      .returning();
    row = updated;
  }

  return row;
}
