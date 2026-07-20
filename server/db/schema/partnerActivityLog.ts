import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const partnerActivityLog = pgTable("partner_activity_log", {
  id: serial("id").primaryKey(),
  /** The partner user this activity belongs to */
  userId: text("user_id").notNull(),
  /** Admin user who performed the action */
  actorId: text("actor_id").notNull(),
  /** Machine-readable action key, e.g. "partner_created", "agreement_accepted" */
  action: text("action").notNull(),
  /** Arbitrary JSON details — promo code, affiliate ID, etc. */
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PartnerActivityLogEntry = typeof partnerActivityLog.$inferSelect;
export type NewPartnerActivityLogEntry = typeof partnerActivityLog.$inferInsert;
