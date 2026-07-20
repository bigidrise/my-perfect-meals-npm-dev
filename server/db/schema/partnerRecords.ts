import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const partnerRecords = pgTable("partner_records", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),

  partnerName: text("partner_name"),
  partnerTypes: text("partner_types").array().default([]),

  promoCode: text("promo_code"),
  customerDiscount: integer("customer_discount"),
  commissionRate: integer("commission_rate"),
  commissionMonths: integer("commission_months"),

  stripePromotionCodeId: text("stripe_promotion_code_id"),
  rewardfulAffiliateId: text("rewardful_affiliate_id"),

  status: text("status").default("pending"),
  notes: text("notes"),

  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  rewardfulCreatedAt: timestamp("rewardful_created_at", { withTimezone: true }),
  promoCodeAssignedAt: timestamp("promo_code_assigned_at", { withTimezone: true }),
  orgActivatedAt: timestamp("org_activated_at", { withTimezone: true }),
  managedPayoutsAt: timestamp("managed_payouts_at", { withTimezone: true }),
  marketingKitReadyAt: timestamp("marketing_kit_ready_at", { withTimezone: true }),
  campaignActiveAt: timestamp("campaign_active_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PartnerRecord = typeof partnerRecords.$inferSelect;
export type InsertPartnerRecord = typeof partnerRecords.$inferInsert;
