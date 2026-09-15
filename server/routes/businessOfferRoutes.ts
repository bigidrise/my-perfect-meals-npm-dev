import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { businessOfferLinks } from "../db/schema/businessOfferLinks";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireMfa } from "../middleware/requireMfa";
import { resolveActiveWorkspace } from "../services/organizationWorkspaceService";
import {
  businessOfferJoinPath,
  ensureDefaultBusinessOffers,
  inspectBusinessOffer,
  redeemBusinessOffer,
} from "../services/businessOfferLinkService";

const router = Router();
const actor = (req: any) => (req as AuthenticatedRequest).authUser.id;
const selection = (req: any) => req.session?.activeOrganizationId && req.session?.activeLocationId
  ? { organizationId: req.session.activeOrganizationId, locationId: req.session.activeLocationId }
  : null;

router.get("/inspect", async (req, res) => {
  const token = req.get("x-business-offer-token");
  if (!token) return res.status(400).json({ error: "Business offer token required." });
  try {
    const offer = await inspectBusinessOffer(token);
    if (!offer) return res.status(404).json({ error: "Business offer not found." });
    return res.json({
      name: offer.name,
      organizationName: offer.organizationName,
      trialDays: offer.trialDays,
      expiresAt: offer.expiresAt,
      available: offer.available,
      referralToken: offer.available ? offer.rewardfulReferralToken : null,
    });
  } catch {
    return res.status(500).json({ error: "Unable to inspect this Business Offer." });
  }
});

router.get("/manage", requireAuth, requireMfa, async (req: any, res) => {
  try {
    const workspace = await resolveActiveWorkspace(actor(req), selection(req));
    if (!["owner", "admin"].includes(workspace.organizationRole)) {
      return res.status(403).json({ error: "Organization owner or administrator access is required." });
    }
    const offers = await ensureDefaultBusinessOffers({
      actorUserId: actor(req),
      organizationId: workspace.organizationId,
      locationId: workspace.locationId,
    });
    return res.json({
      organizationId: workspace.organizationId,
      locationId: workspace.locationId,
      offers: offers.map((offer) => ({
        id: offer.id,
        name: offer.name,
        trialDays: offer.trialDays,
        status: offer.status,
        expiresAt: offer.expiresAt,
        maxRedemptions: offer.maxRedemptions,
        joinPath: businessOfferJoinPath(offer.publicToken, offer.rewardfulReferralToken),
      })),
    });
  } catch (error: any) {
    const status = error?.message === "BUSINESS_OFFER_REWARDFUL_REQUIRED" ? 409 : (error?.status ?? 500);
    return res.status(status).json({
      error: error?.message === "BUSINESS_OFFER_REWARDFUL_REQUIRED"
        ? "Connect and activate this organization’s Rewardful account before creating Business Offer Links."
        : (error?.message ?? "Unable to load Business Offer Links."),
      code: error?.message,
    });
  }
});

router.post("/redeem", requireAuth, async (req: any, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!token) return res.status(400).json({ error: "Business offer token required." });
  try {
    const result = await redeemBusinessOffer(token, actor(req));
    return res.json({
      success: true,
      alreadyRedeemed: result.alreadyRedeemed,
      trialDays: result.entitlement.grantedDurationDays,
      startsAt: result.entitlement.startsAt,
      endsAt: result.entitlement.endsAt,
    });
  } catch (error: any) {
    const status = error?.message === "BUSINESS_OFFER_NOT_FOUND" ? 404
      : error?.message === "BUSINESS_OFFER_CAPACITY" ? 409 : 400;
    return res.status(status).json({ error: "Unable to redeem this Business Offer.", code: error?.message });
  }
});

router.post("/:offerId/revoke", requireAuth, requireMfa, async (req: any, res) => {
  try {
    const workspace = await resolveActiveWorkspace(actor(req), selection(req));
    if (!["owner", "admin"].includes(workspace.organizationRole)) {
      return res.status(403).json({ error: "Organization owner or administrator access is required." });
    }
    const [offer] = await db.update(businessOfferLinks).set({
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId: actor(req),
      revokeReason: typeof req.body?.reason === "string" ? req.body.reason : null,
      updatedAt: new Date(),
    }).where(and(
      eq(businessOfferLinks.id, req.params.offerId),
      eq(businessOfferLinks.organizationId, workspace.organizationId),
      eq(businessOfferLinks.locationId, workspace.locationId),
      eq(businessOfferLinks.status, "active"),
    )).returning({ id: businessOfferLinks.id });
    if (!offer) return res.status(404).json({ error: "Active Business Offer not found." });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(error?.status ?? 500).json({ error: error?.message ?? "Unable to revoke Business Offer." });
  }
});

export default router;