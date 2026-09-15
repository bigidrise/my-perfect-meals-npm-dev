import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@shared/schema";
import { organizations } from "./organizations";
import { organizationLocations } from "./workspaces";
import { userAffiliateAccounts } from "./affiliateAccounts";

export const businessOfferLinks = pgTable("business_offer_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull()
    .references(() => organizationLocations.id, { onDelete: "cascade" }),
  affiliateAccountId: integer("affiliate_account_id").notNull()
    .references(() => userAffiliateAccounts.id, { onDelete: "restrict" }),
  rewardfulAffiliateId: text("rewardful_affiliate_id").notNull(),
  rewardfulReferralToken: text("rewardful_referral_token").notNull(),
  name: text("name").notNull(),
  trialDays: integer("trial_days").notNull(),
  offerType: text("offer_type").notNull().default("business_offer"),
  status: text("status").$type<"active" | "revoked">().notNull().default("active"),
  publicToken: uuid("public_token").notNull().defaultRandom(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxRedemptions: integer("max_redemptions"),
  createdByUserId: text("created_by_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: text("revoked_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  revokeReason: text("revoke_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  publicTokenUnique: uniqueIndex("business_offer_links_public_token_uq").on(table.publicToken),
  organizationLocationDurationUnique: uniqueIndex("business_offer_links_org_location_duration_uq")
    .on(table.organizationId, table.locationId, table.trialDays),
  organizationStatusIdx: index("business_offer_links_org_status_idx")
    .on(table.organizationId, table.status),
}));

export const businessOfferEntitlements = pgTable("business_offer_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  offerId: uuid("offer_id").notNull()
    .references(() => businessOfferLinks.id, { onDelete: "restrict" }),
  organizationId: uuid("organization_id").notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),
  locationId: uuid("location_id").notNull()
    .references(() => organizationLocations.id, { onDelete: "restrict" }),
  affiliateAccountId: integer("affiliate_account_id").notNull()
    .references(() => userAffiliateAccounts.id, { onDelete: "restrict" }),
  rewardfulAffiliateId: text("rewardful_affiliate_id").notNull(),
  rewardfulReferralToken: text("rewardful_referral_token").notNull(),
  grantedDurationDays: integer("granted_duration_days").notNull(),
  status: text("status").$type<"active" | "expired" | "revoked">().notNull().default("active"),
  provenance: text("provenance").notNull().default("business_offer"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userOfferUnique: uniqueIndex("business_offer_entitlements_user_offer_uq")
    .on(table.userId, table.offerId),
  userActiveIdx: index("business_offer_entitlements_user_active_idx")
    .on(table.userId, table.endsAt),
  organizationIdx: index("business_offer_entitlements_org_idx")
    .on(table.organizationId, table.redeemedAt),
}));

export type BusinessOfferLink = typeof businessOfferLinks.$inferSelect;
export type BusinessOfferEntitlement = typeof businessOfferEntitlements.$inferSelect;