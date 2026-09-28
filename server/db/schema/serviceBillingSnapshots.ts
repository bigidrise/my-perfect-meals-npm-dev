import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Verified Stripe subscription facts, separate from entitlement and workspace
 * status. The manual migration is deliberately not mounted in startup.
 * No runtime writer is enabled until webhook/ownership integration is approved.
 */
export const serviceBillingSnapshots = pgTable("stripe_service_subscription_snapshots", {
  stripeSubscriptionId: text("stripe_subscription_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  serviceType: text("service_type").$type<"personal" | "professional" | "organization">().notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  businessId: uuid("business_id"),
  studioId: uuid("studio_id"),
  priceId: text("price_id").notNull(),
  productId: text("product_id").notNull(),
  trustedPlanKey: text("trusted_plan_key").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull(),
  terminalAt: timestamp("terminal_at", { withTimezone: true }),
  sourceEventId: text("source_event_id").notNull(),
  source: text("source").$type<"webhook" | "reconciliation" | "backfill">().notNull(),
  eventCreatedAt: timestamp("event_created_at", { withTimezone: true }).notNull(),
  eventRank: integer("event_rank").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
}, (table) => ({
  ownerIdx: index("service_billing_snapshots_owner_idx").on(table.ownerUserId, table.serviceType),
  businessIdx: index("service_billing_snapshots_business_idx").on(table.businessId),
  studioIdx: index("service_billing_snapshots_studio_idx").on(table.studioId),
}));

export type ServiceBillingSnapshot = typeof serviceBillingSnapshots.$inferSelect;