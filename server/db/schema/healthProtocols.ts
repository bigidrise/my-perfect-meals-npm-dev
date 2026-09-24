import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "../../../shared/schema";

/** Shadow-only until all food surfaces and clinical ownership paths are reviewed. */
export const healthProtocolSources = pgTable("health_protocol_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectUserId: varchar("subject_user_id").notNull().references(() => users.id),
  protocolKey: text("protocol_key").notNull(),
  sourceKind: text("source_kind").notNull(),
  status: text("status").notNull(),
  ownerUserId: varchar("owner_user_id").references(() => users.id),
  careRelationshipId: uuid("care_relationship_id"),
  evidenceRef: text("evidence_ref"),
  acceptedRecommendation: boolean("accepted_recommendation"),
  currentMedicationUse: boolean("current_medication_use"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  subjectProtocol: index("health_protocol_sources_subject_protocol_idx").on(t.subjectUserId, t.protocolKey),
  relationship: index("health_protocol_sources_relationship_idx").on(t.careRelationshipId),
  origin: uniqueIndex("health_protocol_sources_origin_idx").on(
    t.subjectUserId, t.protocolKey, t.sourceKind, t.evidenceRef,
  ),
}));

export const healthProtocolEvents = pgTable("health_protocol_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull().references(() => healthProtocolSources.id),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  reasonCode: text("reason_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sourceTime: index("health_protocol_events_source_time_idx").on(t.sourceId, t.createdAt),
}));