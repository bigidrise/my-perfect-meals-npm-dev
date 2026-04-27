import { pgTable, uuid, varchar, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creatorOnboardingSubmissions = pgTable("creator_onboarding_submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: uuid("creator_id").notNull(),
  answersJson: jsonb("answers_json").notNull(),
  source: varchar("source", { length: 20 }).notNull().default("in_app"),
  reviewNotes: text("review_notes"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CreatorOnboardingSubmission = typeof creatorOnboardingSubmissions.$inferSelect;
export type InsertCreatorOnboardingSubmission = typeof creatorOnboardingSubmissions.$inferInsert;
