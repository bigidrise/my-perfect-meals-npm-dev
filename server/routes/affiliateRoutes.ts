import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { checkBusinessAffiliateEligibility } from "../services/affiliateEligibility";
import { getRewardfulMagicLink, getRewardfulAffiliate } from "../services/rewardfulApi";

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

    return res.json({
      account: {
        affiliateTrack: account.affiliateTrack,
        requiredPhases: account.requiredPhases,
        phase1CompletedAt: account.phase1CompletedAt,
        phase2CompletedAt: account.phase2CompletedAt,
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
