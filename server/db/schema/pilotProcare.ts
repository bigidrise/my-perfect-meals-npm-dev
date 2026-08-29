import { integer, pgTable, text, timestamp, uuid, varchar, index } from "drizzle-orm/pg-core";
import { users } from "@shared/schema";

export const pilotProCareGrants = pgTable("pilot_procare_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull().references(() => users.id),
  grantedByUserId: varchar("granted_by_user_id", { length: 255 }).notNull().references(() => users.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  seatLimit: integer("seat_limit").notNull().default(5),
  reason: text("reason").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: varchar("revoked_by_user_id", { length: 255 }).references(() => users.id),
  revocationReason: text("revocation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  providerHistoryIdx: index("pilot_procare_grants_provider_history_idx").on(table.providerUserId, table.createdAt),
}));