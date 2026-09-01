import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "@shared/schema";

export const pilotPrograms = pgTable("pilot_programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  organizationName: text("organization_name").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  durationDays: integer("duration_days").notNull().default(30),
  pilotStartAt: timestamp("pilot_start_at", { withTimezone: true }),
  pilotEndAt: timestamp("pilot_end_at", { withTimezone: true }),
  createdByUserId: varchar("created_by_user_id", { length: 255 })
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pilotParticipants = pgTable("pilot_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id").notNull()
    .references(() => pilotPrograms.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id, { onDelete: "set null" }),
  participantName: text("participant_name"),
  email: text("email").notNull(),
  normalizedEmail: text("normalized_email").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  entitlementKey: varchar("entitlement_key", { length: 64 })
    .notNull()
    .default("pilot_full_access"),
  source: varchar("source", { length: 50 }).notNull().default("admin_pilot_program"),
  requiresPasswordSetup: boolean("requires_password_setup").notNull().default(false),
  activationTokenHash: text("activation_token_hash"),
  activationTokenExpiresAt: timestamp("activation_token_expires_at", { withTimezone: true }),
  activationSentAt: timestamp("activation_sent_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdByUserId: varchar("created_by_user_id", { length: 255 })
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  programEmailUnique: uniqueIndex("pilot_participants_program_email_unique")
    .on(table.programId, table.normalizedEmail),
  userStatusIdx: index("pilot_participants_user_status_idx")
    .on(table.userId, table.status, table.expiresAt),
  normalizedEmailIdx: index("pilot_participants_email_idx")
    .on(table.normalizedEmail, table.createdAt),
  activationTokenIdx: index("pilot_participants_activation_token_idx")
    .on(table.activationTokenHash, table.activationTokenExpiresAt),
}));

export type PilotProgram = typeof pilotPrograms.$inferSelect;
export type PilotParticipant = typeof pilotParticipants.$inferSelect;