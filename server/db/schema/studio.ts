import { pgTable, uuid, text, timestamp, pgEnum, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const professionalSpaceTypeEnum = pgEnum("professional_space_type", ["studio", "clinic"]);

export const noteTypeEnum = pgEnum("note_type", ["session", "progress", "goal", "recommendation", "general"]);

export const noteVisibilityEnum = pgEnum("note_visibility", ["professional_only", "shared_with_client"]);

export const activityActionEnum = pgEnum("activity_action", [
  "membership_created",
  "membership_activated", 
  "membership_paused",
  "builder_assigned",
  "board_created",
  "board_updated",
  "board_deleted",
  "program_updated",
  "macros_updated",
  "settings_changed",
  "invite_sent",
  "invite_accepted",
  "note_added"
]);

export const studios = pgTable("studios", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique(),
  type: professionalSpaceTypeEnum("type").notNull().default("studio"),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  themeColor: text("theme_color"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studioBilling = pgTable("studio_billing", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }).unique(),
  stripeAccountId: text("stripe_account_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planCode: text("plan_code").notNull().default("studio_59"),
  status: text("status").notNull().default("trialing"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studioMemberships = pgTable("studio_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull().unique(),
  status: text("status").notNull().default("invited"),
  assignedBuilder: text("assigned_builder"),
  activeBoardId: uuid("active_board_id"),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioIdx: index("idx_studio_memberships_studio").on(table.studioId),
}));

export const studioInvites = pgTable("studio_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioIdx: index("idx_studio_invites_studio").on(table.studioId),
  emailIdx: index("idx_studio_invites_email").on(table.email),
}));

export const clientSubscriptions = pgTable("client_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planCode: text("plan_code").notNull().default("client_2999"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioIdx: index("idx_client_subscriptions_studio").on(table.studioId),
}));

export const clientNotes = pgTable("client_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull(),
  authorUserId: text("author_user_id").notNull(),
  noteType: noteTypeEnum("note_type").notNull().default("general"),
  visibility: noteVisibilityEnum("visibility").notNull().default("professional_only"),
  title: text("title"),
  body: text("body").notNull(),
  sessionDate: timestamp("session_date", { withTimezone: true }),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioClientIdx: index("idx_client_notes_studio_client").on(table.studioId, table.clientUserId),
  authorIdx: index("idx_client_notes_author").on(table.authorUserId),
}));

export type Studio = typeof studios.$inferSelect;
export type InsertStudio = typeof studios.$inferInsert;
export type StudioBilling = typeof studioBilling.$inferSelect;
export type InsertStudioBilling = typeof studioBilling.$inferInsert;
export type StudioMembership = typeof studioMemberships.$inferSelect;
export type InsertStudioMembership = typeof studioMemberships.$inferInsert;
export type StudioInvite = typeof studioInvites.$inferSelect;
export type InsertStudioInvite = typeof studioInvites.$inferInsert;
export type ClientSubscription = typeof clientSubscriptions.$inferSelect;
export type InsertClientSubscription = typeof clientSubscriptions.$inferInsert;
export type ClientNote = typeof clientNotes.$inferSelect;
export type InsertClientNote = typeof clientNotes.$inferInsert;

export const clientActivityLog = pgTable("client_activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  action: activityActionEnum("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioClientIdx: index("idx_activity_log_studio_client").on(table.studioId, table.clientUserId),
  actorIdx: index("idx_activity_log_actor").on(table.actorUserId),
  actionIdx: index("idx_activity_log_action").on(table.action),
}));

export type ClientActivityLog = typeof clientActivityLog.$inferSelect;
export type InsertClientActivityLog = typeof clientActivityLog.$inferInsert;
