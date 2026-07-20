import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { partnerRecords } from "../db/schema/partnerRecords";

const router = Router();

// ─── GET /api/partner/identity ───────────────────────────────────────────────
// Authenticated user views their own partner record (if any)
router.get("/identity", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [record] = await db
      .select()
      .from(partnerRecords)
      .where(eq(partnerRecords.userId, userId))
      .limit(1);
    if (!record) {
      return res.json({ partner: null });
    }
    return res.json({ partner: record });
  } catch (err) {
    console.error("[PartnerRoutes] GET /identity error:", err);
    return res.status(500).json({ error: "Failed to load partner identity" });
  }
});

// ─── GET /api/partner/admin/records ──────────────────────────────────────────
// Admin: list all partner records
router.get("/admin/records", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const records = await db.select().from(partnerRecords).orderBy(partnerRecords.createdAt);
    return res.json({ records });
  } catch (err) {
    console.error("[PartnerRoutes] GET /admin/records error:", err);
    return res.status(500).json({ error: "Failed to list partner records" });
  }
});

// ─── POST /api/partner/admin/records ─────────────────────────────────────────
// Admin: create a partner record
router.post("/admin/records", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      userId,
      partnerName,
      partnerTypes,
      promoCode,
      customerDiscount,
      commissionRate,
      commissionMonths,
      stripePromotionCodeId,
      rewardfulAffiliateId,
      status,
      notes,
      acceptedAt,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const [created] = await db
      .insert(partnerRecords)
      .values({
        userId,
        partnerName: partnerName ?? null,
        partnerTypes: partnerTypes ?? [],
        promoCode: promoCode ?? null,
        customerDiscount: customerDiscount ?? null,
        commissionRate: commissionRate ?? null,
        commissionMonths: commissionMonths ?? null,
        stripePromotionCodeId: stripePromotionCodeId ?? null,
        rewardfulAffiliateId: rewardfulAffiliateId ?? null,
        status: status ?? "pending",
        notes: notes ?? null,
        acceptedAt: acceptedAt ? new Date(acceptedAt) : null,
        promoCodeAssignedAt: promoCode ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: partnerRecords.userId,
        set: {
          partnerName: partnerName ?? null,
          partnerTypes: partnerTypes ?? [],
          promoCode: promoCode ?? null,
          customerDiscount: customerDiscount ?? null,
          commissionRate: commissionRate ?? null,
          commissionMonths: commissionMonths ?? null,
          stripePromotionCodeId: stripePromotionCodeId ?? null,
          rewardfulAffiliateId: rewardfulAffiliateId ?? null,
          status: status ?? "pending",
          notes: notes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return res.json({ partner: created });
  } catch (err) {
    console.error("[PartnerRoutes] POST /admin/records error:", err);
    return res.status(500).json({ error: "Failed to create partner record" });
  }
});

// ─── PATCH /api/partner/admin/records/:userId ─────────────────────────────────
// Admin: update a partner record by userId
router.patch("/admin/records/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    const allowed = [
      "partnerName", "partnerTypes", "promoCode", "customerDiscount",
      "commissionRate", "commissionMonths", "stripePromotionCodeId",
      "rewardfulAffiliateId", "status", "notes",
      "acceptedAt", "rewardfulCreatedAt", "promoCodeAssignedAt",
      "orgActivatedAt", "managedPayoutsAt", "marketingKitReadyAt", "campaignActiveAt",
    ];

    for (const key of allowed) {
      if (key in req.body) {
        const val = req.body[key];
        if (
          ["acceptedAt","rewardfulCreatedAt","promoCodeAssignedAt","orgActivatedAt",
           "managedPayoutsAt","marketingKitReadyAt","campaignActiveAt"].includes(key)
        ) {
          updates[key] = val ? new Date(val) : null;
        } else {
          updates[key] = val;
        }
      }
    }

    const [updated] = await db
      .update(partnerRecords)
      .set(updates as any)
      .where(eq(partnerRecords.userId, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Partner record not found" });
    }
    return res.json({ partner: updated });
  } catch (err) {
    console.error("[PartnerRoutes] PATCH /admin/records/:userId error:", err);
    return res.status(500).json({ error: "Failed to update partner record" });
  }
});

export default router;
