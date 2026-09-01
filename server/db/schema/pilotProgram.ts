import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "@shared/schema";
import { businessInvitations, businessMembers, businesses } from "./business";

export const organizationalPilotAuthorizations = pgTable("organizational_pilot_authorizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationName: text("organization_name").notNull(),
  championEmail: text("champion_email").notNull(),
  normalizedChampionEmail: text("normalized_champion_email").notNull(),
  status: varchar("status", { length: 20 })
    .$type<"requested" | "approved" | "claimed" | "rejected" | "revoked" | "expired">()
    .notNull().default("requested"),
  professionalCapacity: integer("professional_capacity").notNull(),
  clientCapacity: integer("client_capacity").notNull(),
  durationDays: integer("duration_days").notNull().default(30),
  claimTokenHash: text("claim_token_hash"),
  claimTokenExpiresAt: timestamp("claim_token_expires_at", { withTimezone: true }),
  businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
  requestedAt: timestamp("requested_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedByUserId: varchar("approved_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  claimedByUserId: varchar("claimed_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: varchar("revoked_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  revocationReason: text("revocation_reason"),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  claimTokenUnique: uniqueIndex("organizational_pilot_authorizations_claim_token_unique").on(table.claimTokenHash),
  championStatusIdx: index("organizational_pilot_authorizations_champion_status_idx").on(table.normalizedChampionEmail, table.status),
  businessIdx: index("organizational_pilot_authorizations_business_idx").on(table.businessId),
}));

export const organizationalPilots = pgTable("organizational_pilots", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  authorizationId: uuid("authorization_id").notNull().references(() => organizationalPilotAuthorizations.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  status: varchar("status", { length: 20 })
    .$type<"preparing" | "active" | "completed" | "cancelled" | "revoked">()
    .notNull().default("preparing"),
  professionalCapacity: integer("professional_capacity").notNull(),
  clientCapacity: integer("client_capacity").notNull(),
  durationDays: integer("duration_days").notNull().default(30),
  championBusinessMemberId: uuid("champion_business_member_id").references(() => businessMembers.id, { onDelete: "set null" }),
  pilotStartAt: timestamp("pilot_start_at", { withTimezone: true }),
  pilotEndAt: timestamp("pilot_end_at", { withTimezone: true }),
  startedByUserId: varchar("started_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  authorizationUnique: uniqueIndex("organizational_pilots_authorization_unique").on(table.authorizationId),
  businessStatusIdx: index("organizational_pilots_business_status_idx").on(table.businessId, table.status),
  activeWindowIdx: index("organizational_pilots_active_window_idx").on(table.status, table.pilotStartAt, table.pilotEndAt),
}));

export const organizationalPilotParticipants = pgTable("organizational_pilot_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  pilotId: uuid("pilot_id").notNull().references(() => organizationalPilots.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  businessMemberId: uuid("business_member_id").references(() => businessMembers.id, { onDelete: "set null" }),
  businessInvitationId: uuid("business_invitation_id").references(() => businessInvitations.id, { onDelete: "set null" }),
  participantName: text("participant_name"),
  email: text("email").notNull(),
  normalizedEmail: text("normalized_email").notNull(),
  populationType: varchar("population_type", { length: 20 }).$type<"professional" | "client">().notNull(),
  participantRole: varchar("participant_role", { length: 32 }).notNull(),
  status: varchar("status", { length: 20 }).$type<"pending" | "active" | "removed" | "replaced">().notNull().default("pending"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  replacedByParticipantId: uuid("replaced_by_participant_id"),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pilotEmailUnique: uniqueIndex("organizational_pilot_participants_pilot_email_unique").on(table.pilotId, table.normalizedEmail),
  capacityIdx: index("organizational_pilot_participants_capacity_idx").on(table.pilotId, table.populationType, table.status),
  userStatusIdx: index("organizational_pilot_participants_user_status_idx").on(table.userId, table.status),
  invitationIdx: index("organizational_pilot_participants_invitation_idx").on(table.businessInvitationId),
}));

export const organizationalPilotEvents = pgTable("organizational_pilot_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  pilotId: uuid("pilot_id").notNull().references(() => organizationalPilots.id, { onDelete: "cascade" }),
  actorUserId: varchar("actor_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  historyIdx: index("organizational_pilot_events_history_idx").on(table.pilotId, table.createdAt),
}));

export type OrganizationalPilotAuthorization = typeof organizationalPilotAuthorizations.$inferSelect;
export type OrganizationalPilot = typeof organizationalPilots.$inferSelect;
export type OrganizationalPilotParticipant = typeof organizationalPilotParticipants.$inferSelect;
export type OrganizationalPilotEvent = typeof organizationalPilotEvents.$inferSelect;