import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const partnerRecords = pgTable("partner_records", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),

  partnerName: text("partner_name"),
  partnerTypes: text("partner_types").array().default([]),

  partnerTier: text("partner_tier"),
  contactName: text("contact_name"),

  promoCode: text("promo_code"),
  promoCodeSecondary: text("promo_code_secondary"),
  customerDiscount: integer("customer_discount"),
  discountDurationMonths: integer("discount_duration_months"),
  commissionRate: integer("commission_rate"),
  commissionMonths: integer("commission_months"),
  commissionPendingDays: integer("commission_pending_days"),
  minimumPayoutCents: integer("minimum_payout_cents"),
  cookieDurationDays: integer("cookie_duration_days"),

  stripePromotionCodeId: text("stripe_promotion_code_id"),
  rewardfulAffiliateId: text("rewardful_affiliate_id"),
  referralCampaignName: text("referral_campaign_name"),

  brandingMode: text("branding_mode").default("standard").notNull(),

  managedPayoutsStatus: text("managed_payouts_status").default("not_applicable"),
  status: text("status").default("pending"),
  notes: text("notes"),
  adminNote: text("admin_note"),

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
