import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "../../../shared/schema";
import type { ExactFoodDirective, ClinicalReviewDisposition } from "../../../shared/clinicalMealAuthority";
import { healthProtocolSources } from "./healthProtocols";

/** DEV shadow tables: excluded from db:push and every production boot path. */
export const healthProtocolFoodDirectives = pgTable("health_protocol_food_directives", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectUserId: varchar("subject_user_id").notNull().references(() => users.id),
  sourceId: uuid("source_id").notNull().references(() => healthProtocolSources.id),
  protocolKey: text("protocol_key").notNull(),
  rule: jsonb("rule").$type<ExactFoodDirective>().notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  supersedesId: uuid("supersedes_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sourceTime: index("health_protocol_food_directives_source_time_idx").on(t.sourceId, t.createdAt),
  subject: index("health_protocol_food_directives_subject_idx").on(t.subjectUserId),
}));

/** Append-only decisions preserve every review, reversal, and deactivation. */
export const healthProtocolReviewDecisions = pgTable("health_protocol_review_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectUserId: varchar("subject_user_id").notNull().references(() => users.id),
  sourceId: uuid("source_id").notNull().references(() => healthProtocolSources.id),
  directiveId: uuid("directive_id").references(() => healthProtocolFoodDirectives.id),
  disposition: text("disposition").$type<ClinicalReviewDisposition>().notNull(),
  actorUserId: varchar("actor_user_id").notNull().references(() => users.id),
  reasonCode: text("reason_code").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  subjectTime: index("health_protocol_review_decisions_subject_time_idx").on(t.subjectUserId, t.decidedAt),
  sourceTime: index("health_protocol_review_decisions_source_time_idx").on(t.sourceId, t.decidedAt),
  directiveTime: index("health_protocol_review_decisions_directive_time_idx").on(t.directiveId, t.decidedAt),
}));