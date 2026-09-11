import { Router } from "express";
import { db } from "../db";
import { and, eq, isNull } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { users } from "../../shared/schema";
import { checkBusinessAffiliateEligibility } from "../services/affiliateEligibility";
import {
  createOrganizationRewardfulAffiliate,
  getRewardfulMagicLink,
  getRewardfulAffiliate,
  getRewardfulAffiliateStatus,
  RewardfulAffiliateConflictError,
} from "../services/rewardfulApi";
import { sendAffiliateReferralInvite } from "../services/emailService";
import { requireEmailService, emailServiceAvailable } from "../middleware/requireEmailService";
import { resolveActiveWorkspace } from "../services/organizationWorkspaceService";
import {
  affiliateAccountScope,
  ensureOrganizationPartnerRevenueShell,
  partnerRecordScope,
  resolveOrganizationPartnerLifecycle,
} from "../services/organizationPartnerRevenueService";
import { partnerRecords } from "../db/schema/partnerRecords";
import { partnerActivityLog } from "../db/schema/partnerActivityLog";

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

function requireOrganizationPartnerManager(workspace: { organizationRole: string }) {
  if (!["owner", "admin"].includes(workspace.organizationRole)) {
    const error = new Error("Organization owner or administrator access is required.") as Error & { status: number };
    error.status = 403;
    throw error;
  }
}

async function organizationAffiliateResponse(
  account: typeof userAffiliateAccounts.$inferSelect,
  workspace: {
    organizationId: string;
    organizationRole: string;
    organizationRelationshipType: string;
  },
) {
  const lifecycle = await resolveOrganizationPartnerLifecycle(workspace.organizationId, account);
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
    hasLinkedRewardful: Boolean(account.rewardfulAffiliateId),
    organizationRole: workspace.organizationRole,
    organizationRelationshipType: workspace.organizationRelationshipType,
    canManage: ["owner", "admin"].includes(workspace.organizationRole),
    organizationRewardfulLifecycle: lifecycle,
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
router.post("/register-track", requireAuth, async (req, res) => {
  try {
    const { userId, workspace, account: existing } = await getOrganizationAffiliateAccount(req);
    requireOrganizationPartnerManager(workspace);
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
router.get("/account", requireAuth, async (req, res) => {
  try {
    const { account, workspace } = await getOrganizationAffiliateAccount(req);
    if (!account) return res.json({ account: null });
    return res.json({ account: await organizationAffiliateResponse(account, workspace) });
  } catch (err) {
    console.error("[Affiliate] account error:", err);
    return res.status(500).json({ error: "Failed to fetch affiliate account" });
  }
});

// ─── GET /api/affiliate/dashboard ─────────────────────────────────────────────
// Returns the full affiliate account record for the partner dashboard page.
// Same data as /account but unwrapped (no nesting) to match AffiliateDashboard expectations.
// requireProAccess: dashboard access is programme participation, not browsing.
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const { account, workspace } = await getOrganizationAffiliateAccount(req);
    if (!account) return res.status(404).json({ error: "No affiliate account found" });
    return res.json(await organizationAffiliateResponse(account, workspace));
  } catch (err) {
    console.error("[Affiliate] dashboard error:", err);
    return res.status(500).json({ error: "Failed to fetch affiliate dashboard" });
  }
});

// ─── GET /api/affiliate/dashboard-link ────────────────────────────────────────
// requireProAccess: generating a Rewardful SSO link is programme participation.
router.get("/dashboard-link", requireAuth, async (req, res) => {
  try {
    const { workspace, account } = await getOrganizationAffiliateAccount(req);
    requireOrganizationPartnerManager(workspace);

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
  } catch (err: any) {
    console.error("[Affiliate] dashboard-link error:", err);
    return res.status(err?.status ?? 500).json({ error: err?.message ?? "Failed to generate dashboard link" });
  }
});

// ─── GET /api/affiliate/rewardful-status ─────────────────────────────────────
// Returns live Rewardful account status: email confirmed, signed in, SSO portal URL.
// Called once by the dashboard on mount to show the account-setup card when needed.
// requireProAccess: only active affiliates (Pro+) access their Rewardful account.
router.get("/rewardful-status", requireAuth, async (req, res) => {
  try {
    const { workspace, account } = await getOrganizationAffiliateAccount(req);
    requireOrganizationPartnerManager(workspace);

    if (!account?.rewardfulAffiliateId) {
      return res.status(404).json({ error: "No Rewardful affiliate account" });
    }

    const status = await getRewardfulAffiliateStatus(account.rewardfulAffiliateId);
    if (!status) {
      return res.status(502).json({ error: "Could not reach Rewardful" });
    }

    return res.json(status);
  } catch (err: any) {
    console.error("[Affiliate] rewardful-status error:", err);
    return res.status(err?.status ?? 500).json({ error: err?.message ?? "Failed to fetch Rewardful status" });
  }
});

// ─── POST /api/affiliate/sync-link ────────────────────────────────────────────
// Manually fetches the latest referral URL/token from Rewardful for accounts
// where the URL is missing (e.g., link wasn't available at creation time).
// requireProAccess: syncing a referral link is programme participation.
router.post("/sync-link", requireAuth, async (req, res) => {
  try {
    const { workspace, account } = await getOrganizationAffiliateAccount(req);
    requireOrganizationPartnerManager(workspace);

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
  } catch (err: any) {
    console.error("[Affiliate] sync-link error:", err);
    return res.status(err?.status ?? 500).json({ error: err?.message ?? "Failed to sync referral link" });
  }
});

// ─── POST /api/affiliate/activate-retry ──────────────────────────────────────
// Organization activation is never inferred from personal Academy credentials.
router.post("/activate-retry", requireAuth, async (req, res) => {
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

router.post("/organization/attach-existing", requireAuth, async (req, res) => {
  try {
    const { userId, workspace, account } = await getOrganizationAffiliateAccount(req);
    requireOrganizationPartnerManager(workspace);
    const affiliateId = String(req.body?.rewardfulAffiliateId ?? "").trim();
    if (!affiliateId) {
      return res.status(400).json({ error: "Rewardful affiliate ID is required." });
    }
    if (account?.rewardfulAffiliateId === affiliateId) {
      return res.json(await organizationAffiliateResponse(account, workspace));
    }
    if (account?.rewardfulAffiliateId) {
      return res.status(409).json({
        error: "This organization already has a Rewardful account linked.",
        code: "ORGANIZATION_REWARDFUL_ALREADY_LINKED",
      });
    }
    const lifecycle = await resolveOrganizationPartnerLifecycle(workspace.organizationId, account!);
    if (!lifecycle.setupAvailable) {
      return res.status(403).json({
        error: "Partner & Revenue setup is not available for this organization yet.",
        code: "ORGANIZATION_PARTNER_SETUP_NOT_AVAILABLE",
        organizationRewardfulLifecycle: lifecycle,
      });
    }
    const [usedBy] = await db
      .select({ organizationId: userAffiliateAccounts.organizationId })
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.rewardfulAffiliateId, affiliateId))
      .limit(1);
    if (usedBy?.organizationId && usedBy.organizationId !== workspace.organizationId) {
      return res.status(409).json({
        error: "This Rewardful account is already attached to another organization.",
        code: "REWARDFUL_AFFILIATE_ALREADY_ASSIGNED",
      });
    }
    const verified = await getRewardfulAffiliate(affiliateId);
    if (!verified?.id || verified.id !== affiliateId) {
      return res.status(404).json({
        error: "Rewardful could not verify that affiliate ID.",
        code: "REWARDFUL_AFFILIATE_NOT_VERIFIED",
      });
    }
    const link = verified.links?.[0];
    const now = new Date();
    const [updated] = await db.transaction(async (tx) => {
      const [saved] = await tx
        .update(userAffiliateAccounts)
        .set({
          rewardfulAffiliateId: verified.id,
          rewardfulState: verified.state,
          rewardfulReferralUrl: link?.url ?? null,
          rewardfulReferralToken: link?.token ?? null,
          rewardfulCampaignId: verified.campaign?.id ?? null,
          activatedAt: now,
          updatedAt: now,
        })
        .where(and(
          affiliateAccountScope(workspace.organizationId),
          isNull(userAffiliateAccounts.rewardfulAffiliateId),
        ))
        .returning();
      if (!saved) throw new Error("Organization Rewardful account changed before attachment completed.");
      await tx.update(partnerRecords).set({
        rewardfulAffiliateId: verified.id,
        rewardfulCreatedAt: now,
        acceptedAt: now,
        contactEmail: verified.email,
        status: verified.state === "active" ? "active" : "setup_in_progress",
        updatedAt: now,
      }).where(partnerRecordScope(workspace.organizationId));
      await tx.insert(partnerActivityLog).values({
        userId,
        actorId: userId,
        action: "organization_rewardful_attached",
        details: {
          organizationId: workspace.organizationId,
          rewardfulAffiliateId: verified.id,
          previousState: "not_activated",
          newState: verified.state,
        },
      });
      return [saved] as const;
    });
    const portalUrl = await getRewardfulMagicLink(verified.id);
    return res.json({
      ...(await organizationAffiliateResponse(updated, workspace)),
      portalUrl,
    });
  } catch (err: any) {
    console.error("[Affiliate] attach existing organization Rewardful error:", err);
    return res.status(err?.status ?? 500).json({ error: err?.message ?? "Could not attach Rewardful account." });
  }
});

router.post("/organization/setup", requireAuth, async (req, res) => {
  let claimedOrganizationId: string | null = null;
  try {
    const { userId, workspace, account } = await getOrganizationAffiliateAccount(req);
    requireOrganizationPartnerManager(workspace);
    if (!account) return res.status(404).json({ error: "Organization affiliate account was not found." });
    if (account.rewardfulAffiliateId) {
      return res.status(409).json({
        error: "This organization already has a Rewardful account linked.",
        code: "ORGANIZATION_REWARDFUL_ALREADY_LINKED",
      });
    }
    const lifecycle = await resolveOrganizationPartnerLifecycle(workspace.organizationId, account);
    if (!lifecycle.setupAvailable) {
      return res.status(403).json({
        error: "Partner & Revenue setup is not available for this organization yet.",
        code: "ORGANIZATION_PARTNER_SETUP_NOT_AVAILABLE",
        organizationRewardfulLifecycle: lifecycle,
      });
    }
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const contactName = String(req.body?.contactName ?? "").trim();
    const nameParts = contactName.split(/\s+/).filter(Boolean);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || nameParts.length < 2) {
      return res.status(400).json({ error: "A valid organization contact name and email are required." });
    }
    const campaignId = process.env.REWARDFUL_CAMPAIGN_ID ?? "";
    if (!campaignId || !process.env.REWARDFUL_API_SECRET) {
      return res.status(503).json({
        error: "Rewardful organization setup is not configured.",
        code: "REWARDFUL_CONFIGURATION_REQUIRED",
      });
    }
    const [claimed] = await db
      .update(userAffiliateAccounts)
      .set({ rewardfulState: "setup_in_progress", updatedAt: new Date() })
      .where(and(
        affiliateAccountScope(workspace.organizationId),
        isNull(userAffiliateAccounts.rewardfulAffiliateId),
        eq(userAffiliateAccounts.rewardfulState, "not_activated"),
      ))
      .returning({ id: userAffiliateAccounts.id });
    if (!claimed) {
      return res.status(409).json({
        error: "Rewardful setup is already in progress or has been completed.",
        code: "ORGANIZATION_REWARDFUL_SETUP_ALREADY_STARTED",
      });
    }
    claimedOrganizationId = workspace.organizationId;
    const affiliate = await createOrganizationRewardfulAffiliate({
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" "),
      email,
      campaignId,
    });
    const link = affiliate.links?.[0];
    const now = new Date();
    const [updated] = await db.transaction(async (tx) => {
      const [saved] = await tx.update(userAffiliateAccounts).set({
        rewardfulAffiliateId: affiliate.id,
        rewardfulState: affiliate.state,
        rewardfulReferralUrl: link?.url ?? null,
        rewardfulReferralToken: link?.token ?? null,
        rewardfulCampaignId: affiliate.campaign?.id ?? campaignId,
        activatedAt: now,
        updatedAt: now,
      }).where(and(
        affiliateAccountScope(workspace.organizationId),
        isNull(userAffiliateAccounts.rewardfulAffiliateId),
        eq(userAffiliateAccounts.rewardfulState, "setup_in_progress"),
      )).returning();
      if (!saved) throw new Error("Organization Rewardful setup was already completed.");
      await tx.update(partnerRecords).set({
        rewardfulAffiliateId: affiliate.id,
        rewardfulCreatedAt: now,
        acceptedAt: now,
        contactName,
        contactEmail: email,
        status: affiliate.state === "active" ? "active" : "setup_in_progress",
        updatedAt: now,
      }).where(partnerRecordScope(workspace.organizationId));
      await tx.insert(partnerActivityLog).values({
        userId,
        actorId: userId,
        action: "organization_rewardful_created",
        details: {
          organizationId: workspace.organizationId,
          rewardfulAffiliateId: affiliate.id,
          previousState: "setup_available",
          newState: affiliate.state,
        },
      });
      return [saved] as const;
    });
    const portalUrl = await getRewardfulMagicLink(affiliate.id);
    claimedOrganizationId = null;
    return res.status(201).json({
      ...(await organizationAffiliateResponse(updated, workspace)),
      portalUrl,
    });
  } catch (err: any) {
    if (claimedOrganizationId) {
      await db.update(userAffiliateAccounts).set({
        rewardfulState: "not_activated",
        updatedAt: new Date(),
      }).where(and(
        affiliateAccountScope(claimedOrganizationId),
        isNull(userAffiliateAccounts.rewardfulAffiliateId),
        eq(userAffiliateAccounts.rewardfulState, "setup_in_progress"),
      )).catch((resetError) => {
        console.error("[Affiliate] could not reset failed organization setup claim:", resetError);
      });
    }
    if (err instanceof RewardfulAffiliateConflictError) {
      return res.status(409).json({
        error: "That email already belongs to a Rewardful affiliate. Use Attach Existing with the exact affiliate ID, or use a distinct organization contact email.",
        code: err.code,
      });
    }
    console.error("[Affiliate] organization Rewardful setup error:", err);
    return res.status(err?.status ?? 500).json({ error: err?.message ?? "Could not start Rewardful setup." });
  }
});

// ─── POST /api/affiliate/send-invite ─────────────────────────────────────────
// requireProAccess: sending referral invitations is a revenue-generating action.
router.post("/send-invite", requireAuth, requireEmailService, async (req, res) => {
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
