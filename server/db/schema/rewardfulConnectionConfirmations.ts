import { pgTable, text, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { organizationLocations } from "./workspaces";

export const rewardfulConnectionConfirmations = pgTable("rewardful_connection_confirmations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => organizationLocations.id, { onDelete: "cascade" }),
  requesterUserId: text("requester_user_id").notNull(),
  rewardfulAffiliateId: text("rewardful_affiliate_id").notNull(),
  destinationEmail: text("destination_email").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenHashUnique: uniqueIndex("rewardful_connection_confirmations_token_hash_uq").on(table.tokenHash),
  organizationCreatedIndex: index("rewardful_connection_confirmations_org_created_idx").on(table.organizationId, table.createdAt),
}));