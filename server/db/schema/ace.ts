import {
  pgTable,
  uuid,
  text,
  boolean,
  smallint,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const coachingProfiles = pgTable("coaching_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  coachingStyle: text("coaching_style"),
  accountabilityPref: text("accountability_pref"),
  motivations: text("motivations").array(),
  lifestyleFlags: text("lifestyle_flags").array(),
  biggestChallenges: text("biggest_challenges").array(),
  coachProfileCompletedAt: timestamp("coach_profile_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const coachingInterventions = pgTable("coaching_interventions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  situation: text("situation").notNull(),
  coachingObjective: text("coaching_objective").notNull(),
  strategies: text("strategies").array().notNull(),
  avoid: text("avoid").array().notNull(),
  evidenceTags: text("evidence_tags").array().notNull(),
  suggestedBuilders: text("suggested_builders").array().notNull(),
  severity: text("severity").notNull().default("low"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const aceDailyCheckins = pgTable(
  "ace_daily_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    date: date("date").notNull(),
    energy: smallint("energy"),
    stress: smallint("stress"),
    sleep: smallint("sleep"),
    mood: smallint("mood"),
    cravings: smallint("cravings"),
    hunger: smallint("hunger"),
    digestion: smallint("digestion"),
    soreness: smallint("soreness"),
    schedule: text("schedule"),
    motivation: smallint("motivation"),
    emotionalEatingRisk: smallint("emotional_eating_risk"),
    symptoms: text("symptoms").array(),
    freeText: text("free_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniqueUserDate: unique().on(t.userId, t.date),
  })
);

export type CoachingProfile = typeof coachingProfiles.$inferSelect;
export type InsertCoachingProfile = typeof coachingProfiles.$inferInsert;
export type CoachingIntervention = typeof coachingInterventions.$inferSelect;
export type InsertCoachingIntervention =
  typeof coachingInterventions.$inferInsert;
export type AceDailyCheckin = typeof aceDailyCheckins.$inferSelect;
export type InsertAceDailyCheckin = typeof aceDailyCheckins.$inferInsert;
