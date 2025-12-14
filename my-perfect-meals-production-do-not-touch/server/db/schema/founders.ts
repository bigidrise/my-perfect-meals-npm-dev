import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Tracks user consent for Week-3 alpha testimonial reminders
 */
export const founderConsent = pgTable("founder_consent", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  cohort: text("cohort").notNull().default("ALPHA"), // ALPHA, BETA, etc.
  hasConsented: boolean("has_consented").notNull().default(false),
  reminderScheduled: boolean("reminder_scheduled").notNull().default(false),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Stores founder testimonials (quote + media)
 */
export const founderTestimonials = pgTable("founder_testimonials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  cohort: text("cohort").notNull().default("ALPHA"),
  name: text("name").notNull(),
  quote: text("quote").notNull(),
  photoUrl: text("photo_url"),
  videoUrl: text("video_url"),
  audioUrl: text("audio_url"),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
