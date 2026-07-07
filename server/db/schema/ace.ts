import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const coachingProfiles = pgTable("coaching_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  coachingStyle: text("coaching_style"),
  accountabilityPref: text("accountability_pref"),
  motivations: text("motivations").array(),
  lifestyleFlags: text("lifestyle_flags").array(),
  biggestChallenges: text("biggest_challenges").array(),
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

export type CoachingProfile = typeof coachingProfiles.$inferSelect;
export type InsertCoachingProfile = typeof coachingProfiles.$inferInsert;
export type CoachingIntervention = typeof coachingInterventions.$inferSelect;
export type InsertCoachingIntervention =
  typeof coachingInterventions.$inferInsert;
