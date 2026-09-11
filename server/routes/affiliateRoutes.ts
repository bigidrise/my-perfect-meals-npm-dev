import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { users } from "../../shared/schema";
import { checkBusinessAffiliateEligibility } from "../services/affiliateEligibility";
import { getRewardfulMagicLink, getRewardfulAffiliate, getRewardfulAffiliateStatus } from "../services/rewardfulApi";
import { sendAffiliateReferralInvite } from "../services/emailService";
import { requireEmailService, emailServiceAvailable } from "../middleware/requireEmailService";
import { resolveActiveWorkspace } from "../services/organizationWorkspaceService";
import {
  affiliateAccountScope,
  ensureOrganizationPartnerRevenueShell,
} from "../services/organizationPartnerRevenueService";

const router = Router();

function sessionSelection(req: any) {
  return req.session?.activeOrganizationId && req.session?.activeLocationId
    ? {
        organizationId: req.session.activeOrganizationId as string,
        locationId: req.session.activeLocationId as string,
      }
    : null;
}

async function getOrganizationAffiliateAccount(req: any) {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const workspace = await resolveActiveWorkspace(userId, sessionSelection(req));
  await ensureOrganizationPartnerRevenueShell(db, {
    userId,
    organizationId: workspace.organizationId,
    organizationName: workspace.organizationName,
  });
  const [account] = await db
    .select()
    .from(userAffiliateAccounts)
    .where(affiliateAccountScope(workspace.organizationId))
    .limit(1);
  return { userId, workspace, account };
}

function organizationAffiliateResponse(account: typeof userAffiliateAccounts.$inferSelect) {
  return {
    organizationId: account.organizationId,
    affiliateTrack: account.affiliateTrack,
    requiredPhases: account.requiredPhases,
    phase1CompletedAt: account.phase1CompletedAt,
    phase2CompletedAt: account.phase2CompletedAt,
    rewardfulState: account.rewardfulState,
    rewardfulReferralUrl: account.rewardfulReferralUrl,
    rewardfulReferralToken: account.rewardfulReferralToken,
    rewardfulCampaignId: account.rewardfulCampaignId,
    activatedAt: account.activatedAt,
    isActive: account.rewardfulState === "active",
  };
}

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
    const { userId, workspace, account: existing } = await getOrganizationAffiliateAccount(req);
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
            .where(affiliateAccountScope(workspace.organizationId));
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
      organizationId: workspace.organizationId,
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
    const { account } = await getOrganizationAffiliateAccount(req);
    if (!account) return res.json({ account: null });
    return res.json({ account: organizationAffiliateResponse(account) });
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
    const { account } = await getOrganizationAffiliateAccount(req);
    if (!account) return res.status(404).json({ error: "No affiliate account found" });
    return res.json(organizationAffiliateResponse(account));
  } catch (err) {
    console.error("[Affiliate] dashboard error:", err);
    return res.status(500).json({ error: "Failed to fetch affiliate dashboard" });
  }
});

// ─── GET /api/affiliate/dashboard-link ────────────────────────────────────────
// requireProAccess: generating a Rewardful SSO link is programme participation.
router.get("/dashboard-link", requireAuth, requireProAccess, async (req, res) => {
  try {
    const { account } = await getOrganizationAffiliateAccount(req);

    if (!account) {
      return res.status(404).json({ error: "No affiliate account found" });
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
    const { account } = await getOrganizationAffiliateAccount(req);

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
    const { workspace, account } = await getOrganizationAffiliateAccount(req);

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
      .where(eq(userAffiliateAccounts.id, account.id));

    console.log(`[Affiliate] sync-link: updated referral URL for organizationId=${workspace.organizationId}`);
    return res.json({ ok: true, referralUrl: fetchedUrl, referralToken: fetchedToken });
  } catch (err) {
    console.error("[Affiliate] sync-link error:", err);
    return res.status(500).json({ error: "Failed to sync referral link" });
  }
});

// ─── POST /api/affiliate/activate-retry ──────────────────────────────────────
// Organization activation is never inferred from personal Academy credentials.
router.post("/activate-retry", requireAuth, requireProAccess, async (req, res) => {
  try {
    const { workspace } = await getOrganizationAffiliateAccount(req);
    return res.status(409).json({
      error: "This organization has not activated its Partner account.",
      code: "ORGANIZATION_PARTNER_NOT_ACTIVATED",
      organizationId: workspace.organizationId,
    });
  } catch (err) {
    console.error("[Affiliate] activate-retry error:", err);
    return res.status(500).json({ error: "Activation retry failed" });
  }
});

// ─── POST /api/affiliate/send-invite ─────────────────────────────────────────
// requireProAccess: sending referral invitations is a revenue-generating action.
router.post("/send-invite", requireAuth, requireProAccess, requireEmailService, async (req, res) => {
  try {
    const { userId, account } = await getOrganizationAffiliateAccount(req);
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
      console.log(`[Rewardful Webhook] ${event.type} for unknown affiliate — ignored`);
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
            .where(eq(userAffiliateAccounts.id, account.id));
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
                      .where(eq(userAffiliateAccounts.id, account.id))
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
          .where(eq(userAffiliateAccounts.id, account.id));
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
