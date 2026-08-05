import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { users } from "../../shared/schema";
import { userCertifications } from "../db/schema/certifications";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { partnerRecords } from "../db/schema/partnerRecords";
import { createRewardfulAffiliate } from "./rewardfulApi";
import { sendAffiliateWelcomeEmail } from "./emailService";

const CAMPAIGN_ID = process.env.REWARDFUL_CAMPAIGN_ID ?? "";

async function isCertCompleted(userId: string, certType: string): Promise<boolean> {
  const [row] = await db
    .select({ status: userCertifications.status })
    .from(userCertifications)
    .where(
      and(
        eq(userCertifications.userId, String(userId)),
        eq(userCertifications.certificationType, certType)
      )
    )
    .limit(1);
  return row?.status === "completed";
}


/**
 * Called after every cert completion.
 * Checks if the user's affiliate track requirements are now met and activates if so.
 */
export async function evaluateAffiliateActivation(userId: string): Promise<void> {
  try {
    const [account] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!account) return; // user hasn't selected a track yet
    if (account.rewardfulAffiliateId) return; // already activated

    const track = account.affiliateTrack;
    let shouldActivate = false;
    let isPhase2Trigger = false;

    if (track === "social_affiliate") {
      const phase1Done = await isCertCompleted(userId, "affiliate_social");
      if (phase1Done) {
        shouldActivate = true;
        // Record phase 1 timestamp if not already set
        if (!account.phase1CompletedAt) {
          await db.update(userAffiliateAccounts)
            .set({ phase1CompletedAt: new Date(), updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, userId));
        }
      }
    } else if (track === "business_affiliate") {
      const phase1Done = await isCertCompleted(userId, "affiliate_social");
      const phase2Done = await isCertCompleted(userId, "platform");

      // Track individual phase completions
      const updates: Record<string, Date> = { updatedAt: new Date() };
      if (phase1Done && !account.phase1CompletedAt) updates.phase1CompletedAt = new Date();
      if (phase2Done && !account.phase2CompletedAt) {
        updates.phase2CompletedAt = new Date();
        isPhase2Trigger = true;
      }
      if (Object.keys(updates).length > 1) {
        await db.update(userAffiliateAccounts)
          .set(updates)
          .where(eq(userAffiliateAccounts.userId, userId));
      }

      if (phase1Done && phase2Done) shouldActivate = true;
    }

    if (!shouldActivate) return;

    // Fetch user details for Rewardful
    const [user] = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.email) {
      console.error("[Affiliate] Cannot activate — no email for userId:", userId);
      return;
    }

    const firstName = user.firstName ?? "Affiliate";
    const lastName = user.lastName ?? "Member";

    console.log(`[Affiliate] Activating ${track} for userId=${userId} (${user.email})`);

    if (!CAMPAIGN_ID) {
      console.warn("[Affiliate] REWARDFUL_CAMPAIGN_ID not set — skipping Rewardful API call");
      return;
    }

    const affiliate = await createRewardfulAffiliate({
      firstName,
      lastName,
      email: user.email,
      campaignId: CAMPAIGN_ID,
    });

    const referralUrl = affiliate.links?.[0]?.url ?? "";
    const referralToken = affiliate.links?.[0]?.token ?? "";

    const activatedAt = new Date();
    await db.update(userAffiliateAccounts)
      .set({
        rewardfulAffiliateId: affiliate.id,
        rewardfulState: affiliate.state,
        rewardfulReferralUrl: referralUrl,
        rewardfulReferralToken: referralToken,
        rewardfulCampaignId: CAMPAIGN_ID,
        activatedAt,
        updatedAt: new Date(),
      })
      .where(eq(userAffiliateAccounts.userId, userId));

    // Auto-stamp partner_records lifecycle milestones if a record exists.
    // rewardfulCreatedAt and acceptedAt are inferred from activation — no manual admin step needed.
    const [partnerRecord] = await db
      .select({ rewardfulCreatedAt: partnerRecords.rewardfulCreatedAt, acceptedAt: partnerRecords.acceptedAt })
      .from(partnerRecords)
      .where(eq(partnerRecords.userId, userId))
      .limit(1);
    if (partnerRecord) {
      const stamps: Record<string, Date> = { updatedAt: new Date() };
      if (!partnerRecord.rewardfulCreatedAt) stamps.rewardfulCreatedAt = activatedAt;
      if (!partnerRecord.acceptedAt) stamps.acceptedAt = activatedAt;
      if (Object.keys(stamps).length > 1) {
        await db.update(partnerRecords).set(stamps as any).where(eq(partnerRecords.userId, userId));
      }
    }

    console.log(`[Affiliate] ✅ Rewardful affiliate created: ${affiliate.id} | state=${affiliate.state}`);
    // Welcome email is sent AFTER Rewardful confirms activation via webhook (state → "active"),
    // not here. Rewardful first sends their own invitation email; MPM welcome email follows
    // only once the user has accepted and Rewardful marks them active.
  } catch (err) {
    console.error("[Affiliate] evaluateAffiliateActivation error:", err);
    // Never throw — cert completion must succeed even if affiliate activation fails
  }
}
