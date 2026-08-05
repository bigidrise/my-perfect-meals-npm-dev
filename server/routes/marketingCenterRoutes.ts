import { Router } from "express";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireProAccess } from "../middleware/requireProAccess";
import { partnerRecords } from "../db/schema/partnerRecords";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { marketingCampaigns, marketingAssets } from "../db/schema/marketingCenter";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";
import QRCode from "qrcode";

const router = Router();
const objectStorage = new ObjectStorageService();

// ─────────────────────────────────────────────────────────────────────────────
// Tier requirement: partner participation endpoints (profile, QR code, campaign
// downloads) require Pro or higher via requireProAccess. Free and Essential
// users are blocked when BILLING_ENFORCED=true — partners are only enrolled on
// Pro+ plans and must remain gated at the API layer, not just the UI.
// The single exception is GET /guidelines — it returns informational brand copy
// with no revenue participation, so any authenticated user may read it.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getPartnerRecord(userId: string) {
  const [record] = await db
    .select()
    .from(partnerRecords)
    .where(eq(partnerRecords.userId, userId))
    .limit(1);
  return record ?? null;
}

/**
 * Returns the branding_mode for an active partner, or null if the user has no
 * active partner record. Never defaults to 'standard' — callers must treat null
 * as unauthorized (403). The fallback-to-standard pattern is intentionally removed
 * to prevent non-partners from accessing standard-visibility campaigns.
 */
async function getActiveBrandingMode(userId: string): Promise<string | null> {
  try {
    const rows = await db.execute(
      sql`SELECT branding_mode, status FROM partner_records WHERE user_id = ${userId} LIMIT 1`
    );
    const row = rows.rows[0] as any;
    if (!row || row.status !== "active") return null;
    return row.branding_mode ?? "standard";
  } catch {
    return null;
  }
}

async function getAffiliateAccount(userId: string) {
  const [account] = await db
    .select()
    .from(userAffiliateAccounts)
    .where(eq(userAffiliateAccounts.userId, userId))
    .limit(1);
  return account ?? null;
}

// ─── Partner: GET /profile ────────────────────────────────────────────────────
// requireProAccess: exposes promo code and referral URL — revenue participation data.
router.get("/profile", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [partner, affiliate] = await Promise.all([
      getPartnerRecord(userId),
      getAffiliateAccount(userId),
    ]);

    if (!partner) {
      return res.json({ hasPartnerAccount: false });
    }

    // Use getActiveBrandingMode so inactive partners show their profile info
    // (status, promo code) but with brandingMode derived from the DB column.
    // For inactive partners the value returned is null; surface that as-is so
    // the client can decide what to show.
    const brandingMode = await getActiveBrandingMode(userId);

    return res.json({
      hasPartnerAccount: true,
      partnerName: partner.partnerName,
      promoCode: partner.promoCode ?? null,
      promoCodeSecondary: partner.promoCodeSecondary ?? null,
      customerDiscount: partner.customerDiscount ?? null,
      referralUrl: affiliate?.rewardfulReferralUrl ?? null,
      brandingMode, // null when inactive; client receives it as-is
      status: partner.status,
    });
  } catch (err) {
    console.error("[MarketingCenter] GET /profile error:", err);
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

// ─── Partner: GET /qr  (?format=png|svg  &download=0|1) ──────────────────────
// requireProAccess: QR code generation encodes a live referral URL — revenue participation.
router.get("/qr", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const format = req.query.format === "svg" ? "svg" : "png";
    const download = req.query.download === "1";

    const [partner, affiliate] = await Promise.all([
      getPartnerRecord(userId),
      getAffiliateAccount(userId),
    ]);

    const targetUrl =
      affiliate?.rewardfulReferralUrl ??
      (partner?.promoCode
        ? `https://app.myperfectmeals.ai?promo=${partner.promoCode}`
        : null);

    if (!targetUrl) {
      return res.status(400).json({ error: "No referral URL configured for this partner" });
    }

    if (format === "svg") {
      const svg = await QRCode.toString(targetUrl, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
      });
      res.setHeader("Content-Type", "image/svg+xml");
      if (download) {
        res.setHeader("Content-Disposition", 'attachment; filename="referral-qr.svg"');
      }
      return res.send(svg);
    } else {
      const buffer = await QRCode.toBuffer(targetUrl, {
        type: "png",
        errorCorrectionLevel: "M",
        margin: 2,
        width: 400,
      });
      res.setHeader("Content-Type", "image/png");
      if (download) {
        res.setHeader("Content-Disposition", 'attachment; filename="referral-qr.png"');
      }
      return res.send(buffer);
    }
  } catch (err) {
    console.error("[MarketingCenter] GET /qr error:", err);
    return res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// ─── Partner: GET /campaigns ──────────────────────────────────────────────────
// Returns only published campaigns where the partner's branding_mode is
// included in audienceModes — enforced server-side, never trusted from client.
// requireProAccess: campaign access is part of revenue participation; a
// downgraded partner with an active record must not retain access on Free tier.
router.get("/campaigns", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const brandingMode = await getActiveBrandingMode(userId);
    if (brandingMode === null) {
      return res.status(403).json({ error: "Active partner account required" });
    }

    const allPublished = await db
      .select()
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.status, "published"))
      .orderBy(desc(marketingCampaigns.monthKey));

    // Server-side visibility enforcement
    const authorized = allPublished.filter((c) => {
      const modes = c.audienceModes ?? [];
      return modes.includes(brandingMode) || modes.includes("all");
    });

    const campaignsWithAssets = await Promise.all(
      authorized.map(async (campaign) => {
        const assets = await db
          .select({
            id: marketingAssets.id,
            assetType: marketingAssets.assetType,
            label: marketingAssets.label,
            filename: marketingAssets.filename,
            mimeType: marketingAssets.mimeType,
            byteSize: marketingAssets.byteSize,
            captionText: marketingAssets.captionText,
            displayOrder: marketingAssets.displayOrder,
          })
          .from(marketingAssets)
          .where(eq(marketingAssets.campaignId, campaign.id))
          .orderBy(marketingAssets.displayOrder);

        return { ...campaign, assets };
      })
    );

    return res.json({ campaigns: campaignsWithAssets });
  } catch (err) {
    console.error("[MarketingCenter] GET /campaigns error:", err);
    return res.status(500).json({ error: "Failed to load campaigns" });
  }
});

// ─── Partner: GET /campaigns/:campaignId/assets/:assetId/download ─────────────
// requireProAccess: downloading marketing assets supports active revenue participation.
router.get("/campaigns/:campaignId/assets/:assetId/download", requireAuth, requireProAccess, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { campaignId, assetId } = req.params;

    const brandingMode = await getActiveBrandingMode(userId);
    if (brandingMode === null) {
      return res.status(403).json({ error: "Active partner account required" });
    }

    // Verify the campaign is published and this partner can see it
    const [campaign] = await db
      .select()
      .from(marketingCampaigns)
      .where(
        and(
          eq(marketingCampaigns.id, campaignId),
          eq(marketingCampaigns.status, "published")
        )
      )
      .limit(1);

    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const modes = campaign.audienceModes ?? [];
    if (!modes.includes(brandingMode) && !modes.includes("all")) {
      return res.status(403).json({ error: "Not authorized for this campaign" });
    }

    // Verify asset belongs to this campaign
    const [asset] = await db
      .select()
      .from(marketingAssets)
      .where(
        and(
          eq(marketingAssets.id, assetId),
          eq(marketingAssets.campaignId, campaignId)
        )
      )
      .limit(1);

    if (!asset) return res.status(404).json({ error: "Asset not found" });

    // Text asset — return text directly (no file stored)
    if (asset.captionText !== null) {
      return res.json({ text: asset.captionText, filename: asset.filename });
    }

    // File asset — stream with Content-Disposition: attachment
    const file = await objectStorage.getObjectEntityFile(asset.objectKey);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(asset.filename)}"`
    );
    await objectStorage.downloadObject(file, res);
  } catch (err: any) {
    console.error("[MarketingCenter] download error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Download failed" });
    }
  }
});

// ─── Partner: GET /guidelines ─────────────────────────────────────────────────
// Hardcoded messaging guide — no DB table needed for V1.

router.get("/guidelines", requireAuth, async (_req, res) => {
  return res.json({
    acknowledgment:
      "By downloading or using these materials, you agree to follow the My Perfect Meals messaging and brand guidelines.",
    academyNote:
      "New partner? Complete the Marketing & Brand Standards lesson in the Academy before promoting My Perfect Meals.",
    approved: [
      {
        label: "Company Description",
        text: "My Perfect Meals is an adaptive nutrition platform that helps users make food decisions based on their goals, dietary needs, preferences, health considerations, and lifestyle.",
      },
      {
        label: "Weight Management",
        text: "My Perfect Meals can support individuals whose goal is weight management by helping them build meals aligned with their nutrition targets and lifestyle.",
      },
      {
        label: "Flexibility",
        text: "Whether your goal is weight management, muscle building, performance, or simply eating better — My Perfect Meals adapts to you.",
      },
    ],
    prohibited: [
      "My Perfect Meals is a weight-loss platform.",
      "My Perfect Meals treats diabetes.",
      "My Perfect Meals replaces a dietitian or physician.",
      "My Perfect Meals guarantees weight loss.",
      "My Perfect Meals cures or reverses a medical condition.",
      "My Perfect Meals is a medical treatment.",
      "Using My Perfect Meals will definitely result in [specific outcome].",
    ],
    disclaimers: [
      "Results vary based on individual adherence, health status, and lifestyle factors.",
      "My Perfect Meals is not a medical device and does not provide medical advice.",
      "Always consult a qualified healthcare provider before making significant dietary changes.",
    ],
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES  (requireAuth + requireAdmin)
// ═════════════════════════════════════════════════════════════════════════════

// ─── Admin: GET /admin/campaigns ─────────────────────────────────────────────

router.get("/admin/campaigns", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const campaigns = await db
      .select()
      .from(marketingCampaigns)
      .orderBy(desc(marketingCampaigns.monthKey));

    const campaignsWithAssets = await Promise.all(
      campaigns.map(async (campaign) => {
        const assets = await db
          .select()
          .from(marketingAssets)
          .where(eq(marketingAssets.campaignId, campaign.id))
          .orderBy(marketingAssets.displayOrder);
        return { ...campaign, assets };
      })
    );

    return res.json({ campaigns: campaignsWithAssets });
  } catch (err) {
    console.error("[MarketingCenter] admin GET /campaigns error:", err);
    return res.status(500).json({ error: "Failed to list campaigns" });
  }
});

// ─── Admin: POST /admin/campaigns ────────────────────────────────────────────

router.post("/admin/campaigns", requireAuth, requireAdmin, async (req, res) => {
  try {
    const actor = (req as AuthenticatedRequest).authUser.id;
    const { title, description, monthKey, audienceModes } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: "title is required" });
    if (!monthKey?.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: "monthKey must be YYYY-MM" });
    }

    const [created] = await db
      .insert(marketingCampaigns)
      .values({
        title: title.trim(),
        description: description?.trim() ?? null,
        monthKey,
        status: "draft",
        audienceModes: Array.isArray(audienceModes) ? audienceModes : [],
        createdBy: actor,
      })
      .returning();

    return res.json({ campaign: created });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "A campaign for this month already exists" });
    }
    console.error("[MarketingCenter] admin POST /campaigns error:", err);
    return res.status(500).json({ error: "Failed to create campaign" });
  }
});

// ─── Admin: PATCH /admin/campaigns/:id ───────────────────────────────────────

router.patch("/admin/campaigns/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, audienceModes, status, expiresAt } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description ?? null;
    if (audienceModes !== undefined) updates.audienceModes = audienceModes;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (status !== undefined) {
      updates.status = status;
      if (status === "published") {
        updates.publishedAt = new Date();
      }
    }

    const [updated] = await db
      .update(marketingCampaigns)
      .set(updates as any)
      .where(eq(marketingCampaigns.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Campaign not found" });
    return res.json({ campaign: updated });
  } catch (err) {
    console.error("[MarketingCenter] admin PATCH /campaigns/:id error:", err);
    return res.status(500).json({ error: "Failed to update campaign" });
  }
});

// ─── Admin: POST /admin/campaigns/:id/assets ─────────────────────────────────
// File assets: pass objectKey (from presigned upload).
// Text assets: pass captionText; objectKey is ignored.

router.post("/admin/campaigns/:id/assets", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { assetType, label, filename, objectKey, mimeType, byteSize, captionText, displayOrder } =
      req.body;

    if (!filename?.trim()) return res.status(400).json({ error: "filename is required" });
    if (!assetType) return res.status(400).json({ error: "assetType is required" });

    const isText = captionText !== undefined && captionText !== null;
    if (!isText && !objectKey) {
      return res.status(400).json({ error: "objectKey is required for file assets" });
    }

    const [asset] = await db
      .insert(marketingAssets)
      .values({
        campaignId: id,
        assetType: assetType ?? "other",
        label: label?.trim() ?? null,
        filename: filename.trim(),
        objectKey: isText ? "" : objectKey,
        mimeType: mimeType ?? null,
        byteSize: byteSize ?? null,
        captionText: isText ? String(captionText) : null,
        displayOrder: displayOrder ?? 0,
      })
      .returning();

    return res.json({ asset });
  } catch (err) {
    console.error("[MarketingCenter] admin POST assets error:", err);
    return res.status(500).json({ error: "Failed to add asset" });
  }
});

// ─── Admin: DELETE /admin/campaigns/:id/assets/:assetId ──────────────────────

router.delete("/admin/campaigns/:id/assets/:assetId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id, assetId } = req.params;
    await db
      .delete(marketingAssets)
      .where(
        and(eq(marketingAssets.id, assetId), eq(marketingAssets.campaignId, id))
      );
    return res.json({ success: true });
  } catch (err) {
    console.error("[MarketingCenter] admin DELETE asset error:", err);
    return res.status(500).json({ error: "Failed to delete asset" });
  }
});

export default router;
