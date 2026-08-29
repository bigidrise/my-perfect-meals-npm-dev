import { boolean, date, index, jsonb, text, timestamp, uniqueIndex, uuid, varchar, pgTable } from "drizzle-orm/pg-core";
import { users } from "@shared/schema";

export const hydrationHubPreferences = pgTable("hydration_hub_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  consented: boolean("consented").notNull().default(false),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
  optedOutAt: timestamp("opted_out_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const hydrationHubBarriers = pgTable("hydration_hub_barriers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  barrierCode: text("barrier_code").notNull(),
  note: text("note"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userBarrierUnique: uniqueIndex("hydration_hub_barriers_user_code_uniq").on(table.userId, table.barrierCode),
  userActiveIdx: index("hydration_hub_barriers_user_active_idx").on(table.userId, table.active),
}));

export const hydrationHubInterventions = pgTable("hydration_hub_interventions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  barrierCode: text("barrier_code").notNull(),
  optionKey: text("option_key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  destinationType: text("destination_type").notNull().default("guidance"),
  destinationRef: text("destination_ref"),
  provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index("hydration_hub_interventions_user_created_idx").on(table.userId, table.createdAt),
}));

export const hydrationHubInterventionEvents = pgTable("hydration_hub_intervention_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  interventionId: uuid("intervention_id").notNull().references(() => hydrationHubInterventions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  interventionCreatedIdx: index("hydration_hub_intervention_events_idx").on(table.interventionId, table.createdAt),
  userCreatedIdx: index("hydration_hub_intervention_events_user_idx").on(table.userId, table.createdAt),
}));

export const hydrationHubLiquidProtocols = pgTable("hydration_hub_liquid_protocols", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  protocolType: text("protocol_type").notNull(),
  source: text("source").notNull().default("user_entered"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  originalInstructionText: text("original_instruction_text").notNull(),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  endsOn: date("ends_on", { mode: "string" }).notNull(),
  reviewOn: date("review_on", { mode: "string" }),
  allowedCategories: jsonb("allowed_categories").$type<string[]>().notNull().default([]),
  restrictedCategories: jsonb("restricted_categories").$type<string[]>().notNull().default([]),
  textureRequirements: jsonb("texture_requirements").$type<string[]>().notNull().default([]),
  explicitTimingText: text("explicit_timing_text"),
  unresolvedItems: jsonb("unresolved_items").$type<Array<{ code: string; label: string }>>().notNull().default([]),
  executionPlan: jsonb("execution_plan").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("draft"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  expiredAt: timestamp("expired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index("hydration_hub_liquid_protocols_user_status_idx").on(table.userId, table.status),
  userCreatedIdx: index("hydration_hub_liquid_protocols_user_created_idx").on(table.userId, table.createdAt),
}));