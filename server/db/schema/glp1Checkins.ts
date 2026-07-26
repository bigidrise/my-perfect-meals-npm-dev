import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * glp1_daily_checkins — structured GLP-1 daily symptom self-assessment
 *
 * WHY a new table instead of extending ace_daily_checkins:
 *   1. ace_daily_checkins has UNIQUE(user_id, date) — one row/day, upserted.
 *      The Hub requires multiple timestamped submissions per day (user checks in
 *      at 7am with nausea, re-checks at noon with no symptoms) for merge/precedence.
 *   2. ace_daily_checkins stores lifestyle/behavioral data (energy, stress, sleep,
 *      mood, cravings, soreness). Adding 15 clinical severity columns violates its
 *      design contract and would break buildAcePromptBlock.ts and legacy aceCheckin.ts.
 *   3. ace_daily_checkins.symptoms[] is a free-text array consumed by keyword matching.
 *      This table stores pre-classified severity enums — a fundamentally different shape.
 *   4. A source discriminator is needed ('hub' | 'ace') for merge-by-timestamp logic in
 *      resolveDailyMedicationTolerance.ts.
 *
 * Design:
 *   - NO unique constraint on (user_id, check_in_date) — allows multiple submissions/day
 *   - submitted_at timestamp drives merge-by-timestamp logic in the resolver
 *   - medication_name/medication_class fields are Phase 2 readiness — stored now, rules later
 *   - notify_care_team stored here for downstream notification routing
 *
 * Resolver behavior:
 *   - The resolver reads the most recent row for today from BOTH this table and ace_daily_checkins
 *   - Whichever has the later submitted_at/updatedAt wins (hub structured data preferred when same second)
 */
export const glp1DailyCheckins = pgTable(
  "glp1_daily_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    checkInDate: date("check_in_date").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    source: text("source").notNull().default("hub"),

    // ── Symptom severity ─────────────────────────────────────────────────────
    // Values: "none" | "mild" | "moderate" | "severe"
    nausea: text("nausea").notNull().default("none"),
    constipation: text("constipation").notNull().default("none"),
    diarrhea: text("diarrhea").notNull().default("none"),
    reflux: text("reflux").notNull().default("none"),
    bloating: text("bloating").notNull().default("none"),
    earlyFullness: text("early_fullness").notNull().default("none"),
    foodAversions: text("food_aversions").notNull().default("none"),
    fatigue: text("fatigue").notNull().default("none"),
    dizziness: text("dizziness").notNull().default("none"),
    headache: text("headache").notNull().default("none"),

    // ── Vomiting frequency ───────────────────────────────────────────────────
    // "none" | "once" | "multiple" | "cant_keep_fluids"
    vomiting: text("vomiting").notNull().default("none"),

    // ── Functional hydration and eating questions ─────────────────────────────
    // canKeepFluidsDown: "yes" | "with_difficulty" | "no"
    canKeepFluidsDown: text("can_keep_fluids_down").notNull().default("yes"),
    // canEatWithoutWorsening: "yes" | "partially" | "no"
    canEatWithoutWorsening: text("can_eat_without_worsening").notNull().default("yes"),
    reducedUrination: boolean("reduced_urination").notNull().default(false),
    // symptomTrend: "improving" | "same" | "worsening" | "na"
    symptomTrend: text("symptom_trend").notNull().default("na"),
    // symptomsAfterDose: "yes" | "no" | "unsure"
    symptomsAfterDose: text("symptoms_after_dose").notNull().default("unsure"),

    // ── Appetite (self-reported) ──────────────────────────────────────────────
    // "suppressed" | "reduced" | "normal" | "increased"
    appetiteLevel: text("appetite_level").notNull().default("normal"),

    // ── Medication profile (Phase 2 readiness) ───────────────────────────────
    // Stored now so medication-specific rules can reference it when activated.
    // The resolver does NOT use these yet — Phase 2 work.
    medicationName: text("medication_name"),
    // "semaglutide" | "tirzepatide" | "oral_glp1" | "research" | "other" | null
    medicationClass: text("medication_class"),

    // ── Care team notification preference ────────────────────────────────────
    // "none" | "coach" | "physician" | "both"
    notifyCareTeam: text("notify_care_team").notNull().default("none"),
  },
  (t) => ({
    userDateIdx: index("glp1_daily_checkins_user_date_idx").on(
      t.userId,
      t.checkInDate,
      t.submittedAt
    ),
  })
);

export type GLP1DailyCheckin = typeof glp1DailyCheckins.$inferSelect;
export type InsertGLP1DailyCheckin = typeof glp1DailyCheckins.$inferInsert;
