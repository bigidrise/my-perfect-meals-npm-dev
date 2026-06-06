import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { users } from "../../shared/schema";
import { checkBusinessAffiliateEligibility } from "../services/affiliateEligibility";
import { getRewardfulMagicLink, getRewardfulAffiliate } from "../services/rewardfulApi";
import { sendAffiliateReferralInvite } from "../services/emailService";

const router = Router();

// ─── GET /api/affiliate/eligibility ──────────────────────────────────────────
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
router.post("/register-track", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { track } = req.body as { track?: string };

    if (!track || !["social_affiliate", "business_affiliate"].includes(track)) {
      return res.status(400).json({ error: "Invalid track. Must be social_affiliate or business_affiliate." });
    }

    // For business track, verify eligibility server-side
    if (track === "business_affiliate") {
      const eligibility = await checkBusinessAffiliateEligibility(userId);
      if (!eligibility.eligible) {
        return res.status(403).json({ error: "Not eligible for business affiliate track.", reason: eligibility.reason });
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
router.get("/account", requireAuth, async (req, res) => {
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
        if (!phase2CompletedAt && (cert.type === "platform" || cert.type === "affiliate_coaching")) {
          phase2CompletedAt = cert.completedAt;
          db.update(userAffiliateAccounts)
            .set({ phase2CompletedAt: cert.completedAt, updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, userId))
            .catch(() => {});
        }
      }
    }

    return res.json({
      account: {
        affiliateTrack: account.affiliateTrack,
        requiredPhases: account.requiredPhases,
        phase1CompletedAt,
        phase2CompletedAt,
        rewardfulState: account.rewardfulState,
        rewardfulReferralUrl: account.rewardfulReferralUrl,
        rewardfulReferralToken: account.rewardfulReferralToken,
        activatedAt: account.activatedAt,
        isActive: account.rewardfulState === "active",
      },
    });
  } catch (err) {
    console.error("[Affiliate] account error:", err);
    return res.status(500).json({ error: "Failed to fetch affiliate account" });
  }
});

// ─── GET /api/affiliate/dashboard-link ────────────────────────────────────────
router.get("/dashboard-link", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [account] = await db
      .select()
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!account?.rewardfulAffiliateId) {
      return res.status(404).json({ error: "No active affiliate account found" });
    }

    if (account.rewardfulState !== "active") {
      return res.status(403).json({ error: "Affiliate account is not active" });
    }

    const magicLink = await getRewardfulMagicLink(account.rewardfulAffiliateId);
    if (!magicLink) {
      return res.status(502).json({ error: "Could not generate affiliate dashboard link" });
    }

    return res.json({ url: magicLink });
  } catch (err) {
    console.error("[Affiliate] dashboard-link error:", err);
    return res.status(500).json({ error: "Failed to generate dashboard link" });
  }
});

// ─── POST /api/affiliate/activate-retry ──────────────────────────────────────
// Re-triggers Rewardful activation for users whose cert requirements are met
// but whose Rewardful account was never created (e.g., campaign ID missing at time of cert).
router.post("/activate-retry", requireAuth, async (req, res) => {
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
router.post("/send-invite", requireAuth, async (req, res) => {
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

    // HMAC verification — check signature if secret is configured
    const webhookSecret = process.env.REWARDFUL_WEBHOOK_SECRET;
    if (webhookSecret) {
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

      case "affiliate.updated":
        if (newState) {
          await db.update(userAffiliateAccounts)
            .set({ rewardfulState: newState, updatedAt: new Date() })
            .where(eq(userAffiliateAccounts.userId, account.userId));
          console.log(`[Rewardful Webhook] affiliate.updated userId=${account.userId} state→${newState}`);
        }
        break;

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
