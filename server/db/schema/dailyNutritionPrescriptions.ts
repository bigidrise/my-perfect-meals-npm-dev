/**
 * Daily Nutrition Prescriptions — Phase 3B
 *
 * Persists the Macro Resolver's daily output so Coach's Corner can compare
 * what the user was SUPPOSED to eat vs what they actually logged.
 *
 * Without this table, adherence coaching is impossible. The Resolver computes
 * targets at request time; this table makes them historical truth.
 *
 * Upsert-safe: unique(user_id, date). Re-running the Resolver on the same day
 * updates the row rather than creating a duplicate.
 *
 * Source hierarchy (matches the platform's resolver ownership rules):
 *   procare             — a professional studio controls this user's targets
 *   performance_overlay — Performance Mode adjusted the baseline
 *   macro_calculator    — standard baseline from the Macro Calculator
 *
 * Coach's Corner needs source to know WHY the target existed on a given date.
 * A Monday rest-day prescription ≠ a Tuesday training-day prescription.
 * Without source context, comparing intake across days produces nonsense.
 */

import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const dailyNutritionPrescriptions = pgTable(
  "daily_nutrition_prescriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: text("user_id").notNull(),

    /** Calendar date this prescription applies to. Format: YYYY-MM-DD */
    date: date("date").notNull(),

    /** Caloric target for the day */
    targetCalories: numeric("target_calories"),

    /** Protein target in grams */
    targetProtein: numeric("target_protein"),

    /** Total carbohydrate target in grams */
    targetTotalCarbs: numeric("target_total_carbs"),

    /**
     * Starchy carbohydrate target in grams (subset of targetTotalCarbs).
     * MPM distinguishes starchy vs fibrous carbs — this is platform-specific.
     */
    targetStarchyCarbs: numeric("target_starchy_carbs"),

    /**
     * Fibrous carbohydrate target in grams (subset of targetTotalCarbs).
     */
    targetFibrousCarbs: numeric("target_fibrous_carbs"),

    /** Fat target in grams */
    targetFat: numeric("target_fat"),

    /**
     * Which resolver tier produced this prescription:
     *   "macro_calculator"    — baseline, no professional override
     *   "performance_overlay" — Performance Mode active; may differ by day type
     *   "procare"             — professional studio controls targets
     */
    source: text("source").notNull().default("macro_calculator"),

    /**
     * Optional version/hash of the resolver config that produced this row.
     * Useful for detecting when targets change due to profile updates.
     */
    sourceVersion: text("source_version"),

    /**
     * For Performance Mode prescriptions: "training" | "rest" | null.
     * Null means Performance Mode was not active or day type was not applicable.
     */
    performanceDayType: text("performance_day_type"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    /** One prescription per user per day — upsert safe */
    userDateUniq: uniqueIndex("dnp_user_date_uniq").on(t.userId, t.date),
  })
);

export type DailyNutritionPrescription =
  typeof dailyNutritionPrescriptions.$inferSelect;
export type InsertDailyNutritionPrescription =
  typeof dailyNutritionPrescriptions.$inferInsert;
