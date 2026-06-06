import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { users } from "../../shared/schema";
import { userCertifications } from "../db/schema/certifications";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { createRewardfulAffiliate } from "./rewardfulApi";
import { sendEmail } from "../emailService";
// sendEmail lives in server/emailService.ts (not server/services/)

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

async function sendAffiliateWelcomeEmail(params: {
  to: string;
  name: string;
  referralUrl: string;
  referralToken: string;
  track: string;
}): Promise<void> {
  const trackLabel =
    params.track === "business_affiliate"
      ? "Business & Coaching Affiliate"
      : "Social & Referral Affiliate";

  await sendEmail({
    to: params.to,
    subject: "Welcome to the My Perfect Meals Affiliate Program",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;border-radius:16px;">
        <h1 style="color:#f97316;font-size:24px;margin-bottom:8px;">Congratulations, ${params.name}!</h1>
        <p style="color:#ccc;font-size:15px;line-height:1.6;margin-bottom:24px;">
          You have successfully completed your <strong>${trackLabel}</strong> certification and your affiliate account is now active.
        </p>

        <div style="background:#111;border:1px solid #f97316;border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="color:#f97316;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Your Referral Link</p>
          <p style="font-family:monospace;font-size:14px;color:#fff;margin:0;word-break:break-all;">${params.referralUrl}</p>
          <p style="color:#888;font-size:12px;margin:8px 0 0;">Token: <strong style="color:#f97316;">${params.referralToken}</strong></p>
        </div>

        <div style="background:#111;border:1px solid #333;border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="color:#f97316;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">Commission Terms</p>
          <ul style="color:#ccc;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
            <li>30% commission on every referred subscription</li>
            <li>Commission paid for 24 months per referred customer</li>
            <li>Real-time tracking in your affiliate dashboard</li>
          </ul>
        </div>

        <p style="color:#888;font-size:13px;line-height:1.6;margin-bottom:24px;">
          <strong style="color:#fff;">Brand Standards Reminder:</strong> When promoting My Perfect Meals, please use only approved marketing materials and messaging. Do not make medical claims, income guarantees, or use unapproved imagery.
        </p>

        <div style="text-align:center;margin-top:32px;">
          <a href="https://myperfectmeals.app/business-center/affiliate" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">Open Affiliate Dashboard</a>
        </div>

        <p style="color:#555;font-size:12px;margin-top:32px;text-align:center;">
          My Perfect Meals — Adaptive AI Nutrition Platform<br/>
          Questions? Contact your affiliate support team.
        </p>
      </div>
    `,
  });
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

    await db.update(userAffiliateAccounts)
      .set({
        rewardfulAffiliateId: affiliate.id,
        rewardfulState: affiliate.state,
        rewardfulReferralUrl: referralUrl,
        rewardfulReferralToken: referralToken,
        rewardfulCampaignId: CAMPAIGN_ID,
        activatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userAffiliateAccounts.userId, userId));

    console.log(`[Affiliate] ✅ Rewardful affiliate created: ${affiliate.id} | state=${affiliate.state}`);

    // Send welcome email (non-blocking)
    try {
      await sendAffiliateWelcomeEmail({
        to: user.email,
        name: `${firstName} ${lastName}`,
        referralUrl,
        referralToken,
        track,
      });
      await db.update(userAffiliateAccounts)
        .set({ welcomeEmailSentAt: new Date(), updatedAt: new Date() })
        .where(eq(userAffiliateAccounts.userId, userId));
    } catch (emailErr) {
      console.error("[Affiliate] Welcome email failed:", emailErr);
    }
  } catch (err) {
    console.error("[Affiliate] evaluateAffiliateActivation error:", err);
    // Never throw — cert completion must succeed even if affiliate activation fails
  }
}
