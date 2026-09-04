import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { users } from "../../shared/schema";
import { checkBusinessAffiliateEligibility } from "../services/affiliateEligibility";
import { getRewardfulMagicLink, getRewardfulAffiliate, getRewardfulAffiliateStatus, getRewardfulAffiliateByEmail } from "../services/rewardfulApi";
import { sendAffiliateReferralInvite } from "../services/emailService";
import { requireEmailService, emailServiceAvailable } from "../middleware/requireEmailService";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Tier requirement: ALL participation endpoints (register, account reads,
// dashboard, link generation, activation, invitations) require Pro or higher.
// Free and Essential users receive 403 PRO_REQUIRED when BILLING_ENFORCED=true.
// The single exception is GET /eligibility — it is informational only (no
// revenue participation) so it passes with any authenticated account.
// ─────────────────────────────────────────────────────────────────────────────

// ─── GET /api/affiliate/eligibility ──────────────────────────────────────────
// Informational only — checks whether the user qualifies; does not enrol them.
// No tier gate: Free users may learn their eligibility status before upgrading.
router.get("/eligibility", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const businessResult = await checkBusinessAffiliateEligibility(userId);
    return res.json({
      social: { eligible: true },
      business: businessResult,
    });
  } catch (err) {
    console.error("[Affiliate] eligibility error:", err);
    return res.status(500).json({ error: "Failed to check eligibility" });
  }
});

// ─── POST /api/affiliate/register-track ──────────────────────────────────────
// requireProAccess: Free/Essential users cannot enrol in the affiliate program.
router.post("/register-track", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { track } = req.body as { track?: string };

    if (!track || !["social_affiliate", "business_affiliate"].includes(track)) {
      return res.status(400).json({ error: "Invalid track. Must be social_affiliate or business_affiliate." });
    }

    // For business track, also verify ProCare/studio eligibility
    if (track === "business_affiliate") {
      const eligibility = await checkBusinessAffiliateEligibility(userId);
      if (!eligibility.eligible) {
        return res.status(403).json({ error: "Not eligible for business affiliate track.", reason: (eligibility as any).reason });
      }
    }

    const [existing] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (existing) {
      // Allow upgrade from social → business, never downgrade
      if (existing.affiliateTrack === "social_affiliate" && track === "business_affiliate") {
        if (!existing.rewardfulAffiliateId) {
          // Not yet activated — safe to upgrade track
          await db.update(userAffiliateAccounts)
            .set({
              affiliateTrack: "business_affiliate",
              requiredPhases: "phase_1_and_2",
              updatedAt: new Date(),
            })
            .where(eq(userAffiliateAccounts.userId, userId));
          return res.json({ ok: true, track: "business_affiliate", upgraded: true });
        }
        // Already activated as social — cannot change track silently
        return res.json({ ok: true, track: existing.affiliateTrack, note: "already_activated" });
      }
      // Same track or business→social (not allowed) — return existing
      return res.json({ ok: true, track: existing.affiliateTrack, note: "already_registered" });
    }

    const requiredPhases = track === "business_affiliate" ? "phase_1_and_2" : "phase_1_only";

    await db.insert(userAffiliateAccounts).values({
      userId,
      affiliateTrack: track,
      requiredPhases,
    });

    return res.json({ ok: true, track, requiredPhases });
  } catch (err) {
    console.error("[Affiliate] register-track error:", err);
    return res.status(500).json({ error: "Failed to register track" });
  }
});

// ─── GET /api/affiliate/account ───────────────────────────────────────────────
// requireProAccess: reading affiliate account data is part of programme participation.
router.get("/account", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [account] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!account) return res.json({ account: null });

    // Resolve phase completion dates — prefer user_affiliate_accounts but fall back
    // to user_certifications so the entry gate never gets stuck in a catch-22.
    let phase1CompletedAt = account.phase1CompletedAt;
    let phase2CompletedAt = account.phase2CompletedAt;

    if (!phase1CompletedAt || !phase2CompletedAt) {
      const { userCertifications } = await import("../db/schema/certifications");
      const certs = await db
        .select({ type: userCertifications.certificationType, completedAt: userCertifications.completedAt })
        .from(userCertifications)
        .where(eq(userCertifications.userId, String(userId)));

      for (const cert of certs) {
        if (!cert.completedAt) continue;
        if (!phase1CompletedAt && cert.type === "affiliate_social") {
          phase1CompletedAt = cert.completedAt;
          // Back-fill the affiliate account so next call is fast
          db.update(userAffiliateAccounts)
            .set({ phase1CompletedAt: cert.completedAt, updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, userId))
            .catch(() => {});
        }
        if (!phase2CompletedAt && (cert.type === "platform" || cert.type === "platform_mastery" || cert.type === "affiliate_coaching")) {
          phase2CompletedAt = cert.completedAt;
          db.update(userAffiliateAccounts)
            .set({ phase2CompletedAt: cert.completedAt, updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, userId))
            .catch(() => {});
        }
      }
    }

    // Auto-refresh referral URL from Rewardful if affiliate exists but URL is missing
    let referralUrl = account.rewardfulReferralUrl;
    let referralToken = account.rewardfulReferralToken;
    if (account.rewardfulAffiliateId && !referralUrl) {
      try {
        const rewardfulAffiliate = await getRewardfulAffiliate(account.rewardfulAffiliateId);
        const fetchedUrl = rewardfulAffiliate?.links?.[0]?.url ?? "";
        const fetchedToken = rewardfulAffiliate?.links?.[0]?.token ?? "";
        if (fetchedUrl) {
          referralUrl = fetchedUrl;
          referralToken = fetchedToken;
          db.update(userAffiliateAccounts)
            .set({ rewardfulReferralUrl: fetchedUrl, rewardfulReferralToken: fetchedToken, updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, userId))
            .catch(() => {});
          console.log(`[Affiliate] Auto-synced referral URL for userId=${userId}`);
        }
      } catch (e) {
        console.warn("[Affiliate] Auto-sync referral URL failed:", e);
      }
    }

    return res.json({
      account: {
        affiliateTrack: account.affiliateTrack,
        requiredPhases: account.requiredPhases,
        phase1CompletedAt,
        phase2CompletedAt,
        rewardfulState: account.rewardfulState,
        rewardfulReferralUrl: referralUrl,
        rewardfulReferralToken: referralToken,
        rewardfulCampaignId: account.rewardfulCampaignId,
        activatedAt: account.activatedAt,
        isActive: account.rewardfulState === "active",
      },
    });
  } catch (err) {
    console.error("[Affiliate] account error:", err);
    return res.status(500).json({ error: "Failed to fetch affiliate account" });
  }
});

// ─── GET /api/affiliate/dashboard ─────────────────────────────────────────────
// Returns the full affiliate account record for the partner dashboard page.
// Same data as /account but unwrapped (no nesting) to match AffiliateDashboard expectations.
// requireProAccess: dashboard access is programme participation, not browsing.
router.get("/dashboard", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [account] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!account) return res.status(404).json({ error: "No affiliate account found" });

    let phase1CompletedAt = account.phase1CompletedAt;
    let phase2CompletedAt = account.phase2CompletedAt;

    if (!phase1CompletedAt || !phase2CompletedAt) {
      const { userCertifications } = await import("../db/schema/certifications");
      const certs = await db
        .select({ type: userCertifications.certificationType, completedAt: userCertifications.completedAt })
        .from(userCertifications)
        .where(eq(userCertifications.userId, String(userId)));

      for (const cert of certs) {
        if (!cert.completedAt) continue;
        if (!phase1CompletedAt && cert.type === "affiliate_social") {
          phase1CompletedAt = cert.completedAt;
          db.update(userAffiliateAccounts)
            .set({ phase1CompletedAt: cert.completedAt, updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, userId))
            .catch(() => {});
        }
        if (!phase2CompletedAt && (cert.type === "platform" || cert.type === "platform_mastery" || cert.type === "affiliate_coaching")) {
          phase2CompletedAt = cert.completedAt;
          db.update(userAffiliateAccounts)
            .set({ phase2CompletedAt: cert.completedAt, updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, userId))
            .catch(() => {});
        }
      }
    }

    let referralUrl = account.rewardfulReferralUrl;
    let referralToken = account.rewardfulReferralToken;
    if (account.rewardfulAffiliateId && !referralUrl) {
      try {
        const rewardfulAffiliate = await getRewardfulAffiliate(account.rewardfulAffiliateId);
        const fetchedUrl = rewardfulAffiliate?.links?.[0]?.url ?? "";
        const fetchedToken = rewardfulAffiliate?.links?.[0]?.token ?? "";
        if (fetchedUrl) {
          referralUrl = fetchedUrl;
          referralToken = fetchedToken;
          db.update(userAffiliateAccounts)
            .set({ rewardfulReferralUrl: fetchedUrl, rewardfulReferralToken: fetchedToken, updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, userId))
            .catch(() => {});
        }
      } catch (e) {
        console.warn("[Affiliate] dashboard auto-sync referral URL failed:", e);
      }
    }

    return res.json({
      affiliateTrack: account.affiliateTrack,
      requiredPhases: account.requiredPhases,
      phase1CompletedAt,
      phase2CompletedAt,
      rewardfulState: account.rewardfulState,
      rewardfulReferralUrl: referralUrl,
      rewardfulReferralToken: referralToken,
      rewardfulCampaignId: account.rewardfulCampaignId,
      activatedAt: account.activatedAt,
      isActive: account.rewardfulState === "active",
    });
  } catch (err) {
    console.error("[Affiliate] dashboard error:", err);
    return res.status(500).json({ error: "Failed to fetch affiliate dashboard" });
  }
});

// ─── GET /api/affiliate/dashboard-link ────────────────────────────────────────
// requireProAccess: generating a Rewardful SSO link is programme participation.
router.get("/dashboard-link", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    let [account] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!account) {
      return res.status(404).json({ error: "No affiliate account found" });
    }

    // Auto-seed: if rewardfulAffiliateId is missing, look up by email from Rewardful
    if (!account.rewardfulAffiliateId) {
      const [userRow] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userRow?.email) {
        const rewardfulAffiliate = await getRewardfulAffiliateByEmail(userRow.email);
        if (rewardfulAffiliate?.id) {
          const seedFields: Record<string, unknown> = {
            rewardfulAffiliateId: rewardfulAffiliate.id,
            updatedAt: new Date(),
          };
          if (rewardfulAffiliate.state) seedFields.rewardfulState = rewardfulAffiliate.state;
          if (rewardfulAffiliate.links?.[0]?.url && !account.rewardfulReferralUrl) {
            seedFields.rewardfulReferralUrl = rewardfulAffiliate.links[0].url;
          }
          if (rewardfulAffiliate.links?.[0]?.token && !account.rewardfulReferralToken) {
            seedFields.rewardfulReferralToken = rewardfulAffiliate.links[0].token;
          }
          await db.update(userAffiliateAccounts)
            .set(seedFields as any)
            .where(eq(userAffiliateAccounts.userId, userId));
          account = { ...account, rewardfulAffiliateId: rewardfulAffiliate.id, rewardfulState: (rewardfulAffiliate.state ?? account.rewardfulState) };
          console.log(`[Affiliate] dashboard-link: auto-seeded rewardfulAffiliateId=${rewardfulAffiliate.id} for userId=${userId}`);
        }
      }
    }

    if (!account.rewardfulAffiliateId) {
      return res.status(404).json({ error: "No Rewardful affiliate account linked" });
    }

    // Generate SSO magic link — this bypasses Rewardful's 2FA entirely.
    // NEVER fall back to the direct dashboard URL: that route requires Rewardful's
    // own login + 2FA, which breaks when their email delivery fails (exactly the
    // "Couldn't send code" error users see). If SSO fails, surface an error so
    // the user retries; do not silently redirect them to a 2FA wall.
    let url: string | null = null;
    try {
      url = await getRewardfulMagicLink(account.rewardfulAffiliateId);
    } catch (ssoErr) {
      console.error("[Affiliate] dashboard-link: SSO magic link failed:", ssoErr);
    }
    if (!url) {
      return res.status(502).json({
        error: "Could not generate your portal link right now. Please try again in a moment.",
      });
    }

    return res.json({ url });
  } catch (err) {
    console.error("[Affiliate] dashboard-link error:", err);
    return res.status(500).json({ error: "Failed to generate dashboard link" });
  }
});

// ─── GET /api/affiliate/rewardful-status ─────────────────────────────────────
// Returns live Rewardful account status: email confirmed, signed in, SSO portal URL.
// Called once by the dashboard on mount to show the account-setup card when needed.
// requireProAccess: only active affiliates (Pro+) access their Rewardful account.
router.get("/rewardful-status", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [account] = await db
      .select({ rewardfulAffiliateId: userAffiliateAccounts.rewardfulAffiliateId })
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!account?.rewardfulAffiliateId) {
      return res.status(404).json({ error: "No Rewardful affiliate account" });
    }

    const status = await getRewardfulAffiliateStatus(account.rewardfulAffiliateId);
    if (!status) {
      return res.status(502).json({ error: "Could not reach Rewardful" });
    }

    return res.json(status);
  } catch (err) {
    console.error("[Affiliate] rewardful-status error:", err);
    return res.status(500).json({ error: "Failed to fetch Rewardful status" });
  }
});

// ─── POST /api/affiliate/sync-link ────────────────────────────────────────────
// Manually fetches the latest referral URL/token from Rewardful for accounts
// where the URL is missing (e.g., link wasn't available at creation time).
// requireProAccess: syncing a referral link is programme participation.
router.post("/sync-link", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [account] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!account?.rewardfulAffiliateId) {
      return res.status(404).json({ error: "No Rewardful affiliate account found" });
    }

    const rewardfulAffiliate = await getRewardfulAffiliate(account.rewardfulAffiliateId);
    const fetchedUrl = rewardfulAffiliate?.links?.[0]?.url ?? "";
    const fetchedToken = rewardfulAffiliate?.links?.[0]?.token ?? "";

    if (!fetchedUrl) {
      return res.status(404).json({ error: "Rewardful has not generated a referral link yet" });
    }

    await db.update(userAffiliateAccounts)
      .set({ rewardfulReferralUrl: fetchedUrl, rewardfulReferralToken: fetchedToken, updatedAt: new Date() })
      .where(eq(userAffiliateAccounts.userId, userId));

    console.log(`[Affiliate] sync-link: updated referral URL for userId=${userId}`);
    return res.json({ ok: true, referralUrl: fetchedUrl, referralToken: fetchedToken });
  } catch (err) {
    console.error("[Affiliate] sync-link error:", err);
    return res.status(500).json({ error: "Failed to sync referral link" });
  }
});

// ─── POST /api/affiliate/activate-retry ──────────────────────────────────────
// Re-triggers Rewardful activation for users whose cert requirements are met
// but whose Rewardful account was never created (e.g., campaign ID missing at time of cert).
// requireProAccess: triggering activation is the final step of programme enrolment.
router.post("/activate-retry", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { evaluateAffiliateActivation } = await import("../services/affiliateActivation");
    await evaluateAffiliateActivation(userId);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Affiliate] activate-retry error:", err);
    return res.status(500).json({ error: "Activation retry failed" });
  }
});

// ─── POST /api/affiliate/send-invite ─────────────────────────────────────────
// requireProAccess: sending referral invitations is a revenue-generating action.
router.post("/send-invite", requireAuth, requireProAccess, requireEmailService, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { name, email } = req.body as { name?: string; email?: string };

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "name and email are required" });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // Verify sender is an active affiliate
    const [account] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!account?.rewardfulReferralUrl || account.rewardfulState !== "active") {
      return res.status(403).json({ error: "Active affiliate account required to send invitations" });
    }

    // Get sender name
    const [sender] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const fromName = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") || "A My Perfect Meals Affiliate";

    const sent = await sendAffiliateReferralInvite({
      to: email.trim(),
      toName: name.trim(),
      fromName,
      referralUrl: account.rewardfulReferralUrl,
    });

    if (!sent) {
      return res.status(502).json({ error: "Failed to send invitation email" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[Affiliate] send-invite error:", err);
    return res.status(500).json({ error: "Failed to send invitation" });
  }
});

// ─── POST /api/webhooks/rewardful ─────────────────────────────────────────────
// Registered separately in routes.ts — handler exported for reuse
export async function handleRewardfulWebhook(req: any, res: any) {
  try {
    const { event, object } = req.body ?? {};
    if (!event?.type || !object?.email) {
      return res.status(200).json({ received: true });
    }

    // HMAC verification is mandatory because this callback is intentionally
    // exempt from browser Origin checks.
    const webhookSecret = process.env.REWARDFUL_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Rewardful Webhook] REWARDFUL_WEBHOOK_SECRET is not configured");
      return res.status(503).json({ error: "Webhook verification unavailable" });
    }
    {
      const signature = req.headers["x-rewardful-signature"] as string | undefined;
      if (!signature) {
        console.warn("[Rewardful Webhook] Missing signature header");
        return res.status(401).json({ error: "Missing signature" });
      }
      const crypto = await import("crypto");
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (signature !== expected) {
        console.warn("[Rewardful Webhook] Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const email = object.email as string;
    const newState = object.state as string | undefined;

    // Look up user by Rewardful affiliate ID or email
    const affiliateId = object.id as string;
    const [account] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.rewardfulAffiliateId, affiliateId))
      .limit(1);

    if (!account) {
      console.log(`[Rewardful Webhook] ${event.type} for unknown affiliate ${affiliateId} (${email}) — ignored`);
      return res.status(200).json({ received: true });
    }

    switch (event.type) {
      case "affiliate.created":
        // MPM triggered this — log only
        console.log(`[Rewardful Webhook] affiliate.created for userId=${account.userId}`);
        break;

      case "affiliate.updated": {
        const updatedFields: Record<string, unknown> = { updatedAt: new Date() };
        if (newState) updatedFields.rewardfulState = newState;
        const webhookUrl = (object as any).links?.[0]?.url as string | undefined;
        const webhookToken = (object as any).links?.[0]?.token as string | undefined;
        if (webhookUrl && !account.rewardfulReferralUrl) updatedFields.rewardfulReferralUrl = webhookUrl;
        if (webhookToken && !account.rewardfulReferralToken) updatedFields.rewardfulReferralToken = webhookToken;

        if (Object.keys(updatedFields).length > 1) {
          await db.update(userAffiliateAccounts)
            .set(updatedFields as any)
            .where(eq(userAffiliateAccounts.userId, account.userId));
          console.log(`[Rewardful Webhook] affiliate.updated userId=${account.userId} state→${newState}`);

          // When Rewardful confirms active, send the MPM activation email with referral link
          if (newState === "active" && !account.welcomeEmailSentAt) {
            const [affiliateUser] = await db
              .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
              .from(users)
              .where(eq(users.id, account.userId))
              .limit(1);

            if (affiliateUser?.email) {
              if (!emailServiceAvailable()) {
                console.warn(`[Rewardful Webhook] Email service not configured — welcome email skipped for userId=${account.userId}`);
              } else {
                const name = [affiliateUser.firstName, affiliateUser.lastName].filter(Boolean).join(" ") || "Affiliate";
                // Prefer the URL from the webhook payload (just saved to DB) over the stale account snapshot
                const emailReferralUrl = webhookUrl ?? account.rewardfulReferralUrl ?? "";
                const emailReferralToken = webhookToken ?? account.rewardfulReferralToken ?? "";
                // @ts-ignore
                (sendAffiliateWelcomeEmail as any)({
                  to: affiliateUser.email,
                  name,
                  referralUrl: emailReferralUrl,
                  referralToken: emailReferralToken,
                  track: account.affiliateTrack ?? "social_affiliate",
                }).then((sent: boolean) => {
                  if (sent) {
                    db.update(userAffiliateAccounts)
                      .set({ welcomeEmailSentAt: new Date(), updatedAt: new Date() })
                      .where(eq(userAffiliateAccounts.userId, account.userId))
                      .catch(() => {});
                  }
                }).catch((e: unknown) => console.error("[Rewardful Webhook] Welcome email failed:", e));
              }
            }
          }
        }
        break;
      }

      case "affiliate.deleted":
        await db.update(userAffiliateAccounts)
          .set({ rewardfulState: "deleted", rewardfulAffiliateId: null, updatedAt: new Date() })
          .where(eq(userAffiliateAccounts.userId, account.userId));
        console.log(`[Rewardful Webhook] affiliate.deleted userId=${account.userId}`);
        break;

      default:
        console.log(`[Rewardful Webhook] unhandled event: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[Rewardful Webhook] error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}

export default router;
