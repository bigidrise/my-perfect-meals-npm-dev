import { pgTable, serial, varchar, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Audit table for lab-driven protocol recommendations.
 *
 * Each row records one recommendation presented to a user after lab save.
 * status values:
 *   'accepted'  — user chose to switch to the recommended plan
 *   'rejected'  — user chose to keep their current plan
 *   'advisory'  — physician was locked; recommendation was shown informational-only
 */
export const clinicalProtocolRecommendations = pgTable(
  "clinical_protocol_recommendations",
  {
    id:                  serial("id").primaryKey(),
    userId:              varchar("user_id", { length: 64 }).notNull(),
    clinicalLabId:       integer("clinical_lab_id"),
    recommendedProtocol: text("recommended_protocol").notNull(),
    status:              text("status").notNull().default("pending"),
    confidenceLevel:     text("confidence_level"),
    triggerFields:       jsonb("trigger_fields"),
    reason:              text("reason"),
    createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("idx_cpr_user_id").on(t.userId),
  }),
);

export type ClinicalProtocolRecommendation =
  typeof clinicalProtocolRecommendations.$inferSelect;
export type InsertClinicalProtocolRecommendation =
  typeof clinicalProtocolRecommendations.$inferInsert;
