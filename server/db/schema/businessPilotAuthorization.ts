import {
  check,
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
import { sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { organizations } from "./organizations";

export type BusinessPilotAuthorizationStatus =
  | "pending"
  | "active"
  | "expired"
  | "revoked"
  | "converted";
export type BusinessPilotDurationPolicy = "fixed" | "indefinite" | "custom";

/**
 * Exact-user Business Pilot access. This table deliberately has no business,
 * membership, provider, or billing relationship: claiming it only records the
 * immutable user binding and is consumed by access resolution.
 */
export const businessPilotAuthorizations = pgTable(
  "business_pilot_authorizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorizedEmail: text("authorized_email").notNull(),
    normalizedAuthorizedEmail: text("normalized_authorized_email").notNull(),
    status: varchar("status", { length: 16 })
      .$type<BusinessPilotAuthorizationStatus>()
      .notNull()
      .default("pending"),
    createdByUserId: varchar("created_by_user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    durationPolicy: varchar("duration_policy", { length: 16 })
      .$type<BusinessPilotDurationPolicy>()
      .notNull()
      .default("fixed"),
    durationDays: integer("duration_days"),
    accessProvenance: varchar("access_provenance", { length: 32 })
      .notNull()
      .default("business_pilot"),
    claimedUserId: varchar("claimed_user_id", { length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    notes: text("notes"),
    internalMetadata: jsonb("internal_metadata").$type<Record<string, unknown>>(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: varchar("revoked_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
    revokeReason: text("revoke_reason"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedByUserId: varchar("ended_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
    endReason: text("end_reason"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    convertedByUserId: varchar("converted_by_user_id", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
    conversionReason: text("conversion_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    openEmailUnique: uniqueIndex("business_pilot_authorizations_open_email_unique")
      .on(table.normalizedAuthorizedEmail)
      .where(sql`${table.status} IN ('pending', 'active')`),
    emailStatusIdx: index("business_pilot_authorizations_email_status_idx")
      .on(table.normalizedAuthorizedEmail, table.status),
    claimedUserIdx: index("business_pilot_authorizations_claimed_user_idx")
      .on(table.claimedUserId),
    organizationIdx: index("business_pilot_authorizations_organization_idx")
      .on(table.organizationId),
    statusWindowIdx: index("business_pilot_authorizations_status_window_idx")
      .on(table.status, table.startsAt, table.expiresAt),
    statusCheck: check(
      "business_pilot_authorizations_status_check",
      sql`${table.status} IN ('pending', 'active', 'expired', 'revoked', 'converted')`,
    ),
    durationPolicyCheck: check(
      "business_pilot_authorizations_duration_policy_check",
      sql`${table.durationPolicy} IN ('fixed', 'indefinite', 'custom')`,
    ),
    provenanceCheck: check(
      "business_pilot_authorizations_provenance_check",
      sql`${table.accessProvenance} = 'business_pilot'`,
    ),
    datesCheck: check(
      "business_pilot_authorizations_dates_check",
      sql`${table.expiresAt} IS NULL OR ${table.startsAt} IS NULL OR ${table.expiresAt} > ${table.startsAt}`,
    ),
    durationDaysCheck: check(
      "business_pilot_authorizations_duration_days_check",
      sql`${table.durationDays} IS NULL OR ${table.durationDays} BETWEEN 1 AND 3650`,
    ),
  }),
);

export type BusinessPilotAuthorization = typeof businessPilotAuthorizations.$inferSelect;
export type NewBusinessPilotAuthorization = typeof businessPilotAuthorizations.$inferInsert;