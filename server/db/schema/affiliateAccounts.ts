import { pgTable, serial, text, timestamp, boolean, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const userAffiliateAccounts = pgTable("user_affiliate_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),

  affiliateTrack: text("affiliate_track").notNull(),
  requiredPhases: text("required_phases").notNull(),

  phase1CompletedAt: timestamp("phase_1_completed_at", { withTimezone: true }),
  phase2CompletedAt: timestamp("phase_2_completed_at", { withTimezone: true }),

  rewardfulAffiliateId: text("rewardful_affiliate_id"),
  rewardfulState: text("rewardful_state"),
  rewardfulReferralUrl: text("rewardful_referral_url"),
  rewardfulReferralToken: text("rewardful_referral_token"),
  rewardfulCampaignId: text("rewardful_campaign_id"),

  activatedAt: timestamp("activated_at", { withTimezone: true }),
  welcomeEmailSentAt: timestamp("welcome_email_sent_at", { withTimezone: true }),
  providerVerifiedSnapshot: boolean("provider_verified_snapshot").default(false),

  // Future expansion (nullable, unused for now)
  whiteLabelPartner: text("white_label_partner"),
  enterprisePartner: text("enterprise_partner"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationUnique: uniqueIndex("user_affiliate_accounts_organization_uq").on(table.organizationId),
  rewardfulAffiliateUnique: uniqueIndex("user_affiliate_accounts_rewardful_affiliate_uq").on(table.rewardfulAffiliateId),
}));

export type UserAffiliateAccount = typeof userAffiliateAccounts.$inferSelect;
export type InsertUserAffiliateAccount = typeof userAffiliateAccounts.$inferInsert;
