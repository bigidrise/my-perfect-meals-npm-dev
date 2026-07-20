import { Router } from "express";
import { db } from "../db";
import { eq, or, ilike, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { partnerRecords } from "../db/schema/partnerRecords";
import { partnerActivityLog } from "../db/schema/partnerActivityLog";
import { users } from "../../shared/schema";
import { computePartnerLifecycle } from "../../shared/partnerLifecycle";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actorId(req: AuthenticatedRequest): string {
  return req.authUser.id;
}

async function getRecord(userId: string) {
  const [record] = await db
    .select()
    .from(partnerRecords)
    .where(eq(partnerRecords.userId, userId))
    .limit(1);
  return record ?? null;
}

async function getActivityLog(userId: string) {
  return db
    .select()
    .from(partnerActivityLog)
    .where(eq(partnerActivityLog.userId, userId))
    .orderBy(desc(partnerActivityLog.createdAt));
}

function lifecycleResponse(record: typeof partnerRecords.$inferSelect, log: (typeof partnerActivityLog.$inferSelect)[]) {
  const lifecycle = computePartnerLifecycle({
    partnerTypes: record.partnerTypes ?? [],
    acceptedAt: record.acceptedAt,
    rewardfulCreatedAt: record.rewardfulCreatedAt,
    rewardfulAffiliateId: record.rewardfulAffiliateId,
    promoCode: record.promoCode,
    promoCodeAssignedAt: record.promoCodeAssignedAt,
    orgActivatedAt: record.orgActivatedAt,
    managedPayoutsAt: record.managedPayoutsAt,
    campaignActiveAt: record.campaignActiveAt,
  });
  return { partner: record, lifecycle, log };
}

// ─── User-facing: GET /api/partner/identity ───────────────────────────────────
router.get("/identity", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const record = await getRecord(userId);
    if (!record) return res.json({ partner: null, lifecycle: null });

    const lifecycle = computePartnerLifecycle({
      partnerTypes: record.partnerTypes ?? [],
      acceptedAt: record.acceptedAt,
      rewardfulCreatedAt: record.rewardfulCreatedAt,
      rewardfulAffiliateId: record.rewardfulAffiliateId,
      promoCode: record.promoCode,
      promoCodeAssignedAt: record.promoCodeAssignedAt,
      orgActivatedAt: record.orgActivatedAt,
      managedPayoutsAt: record.managedPayoutsAt,
      campaignActiveAt: record.campaignActiveAt,
    });
    return res.json({ partner: record, lifecycle });
  } catch (err) {
    console.error("[PartnerRoutes] GET /identity error:", err);
    return res.status(500).json({ error: "Failed to load partner identity" });
  }
});

// ─── Admin: GET /api/partner/admin/records ────────────────────────────────────
router.get("/admin/records", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const records = await db.select().from(partnerRecords).orderBy(partnerRecords.createdAt);
    return res.json({ records });
  } catch (err) {
    console.error("[PartnerRoutes] GET /admin/records error:", err);
    return res.status(500).json({ error: "Failed to list partner records" });
  }
});

// ─── Admin: POST /api/partner/admin/records (escape hatch) ───────────────────
router.post("/admin/records", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, partnerName, partnerTypes, promoCode, customerDiscount, commissionRate,
      commissionMonths, stripePromotionCodeId, rewardfulAffiliateId, status, notes, acceptedAt } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const [created] = await db
      .insert(partnerRecords)
      .values({
        userId, partnerName: partnerName ?? null, partnerTypes: partnerTypes ?? [],
        promoCode: promoCode ?? null, customerDiscount: customerDiscount ?? null,
        commissionRate: commissionRate ?? null, commissionMonths: commissionMonths ?? null,
        stripePromotionCodeId: stripePromotionCodeId ?? null, rewardfulAffiliateId: rewardfulAffiliateId ?? null,
        status: status ?? "pending", notes: notes ?? null,
        acceptedAt: acceptedAt ? new Date(acceptedAt) : null,
        promoCodeAssignedAt: promoCode ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: partnerRecords.userId,
        set: { partnerName: partnerName ?? null, partnerTypes: partnerTypes ?? [], updatedAt: new Date() },
      })
      .returning();
    return res.json({ partner: created });
  } catch (err) {
    console.error("[PartnerRoutes] POST /admin/records error:", err);
    return res.status(500).json({ error: "Failed to create partner record" });
  }
});

// ─── Admin: PATCH /api/partner/admin/records/:userId (escape hatch) ──────────
router.patch("/admin/records/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const timestampFields = ["acceptedAt","rewardfulCreatedAt","promoCodeAssignedAt","orgActivatedAt",
      "managedPayoutsAt","marketingKitReadyAt","campaignActiveAt"];
    const allowed = ["partnerName","partnerTypes","promoCode","customerDiscount","commissionRate",
      "commissionMonths","stripePromotionCodeId","rewardfulAffiliateId","status","notes", ...timestampFields];
    for (const key of allowed) {
      if (key in req.body) {
        updates[key] = timestampFields.includes(key) ? (req.body[key] ? new Date(req.body[key]) : null) : req.body[key];
      }
    }
    const [updated] = await db.update(partnerRecords).set(updates as any).where(eq(partnerRecords.userId, userId)).returning();
    if (!updated) return res.status(404).json({ error: "Partner record not found" });
    return res.json({ partner: updated });
  } catch (err) {
    console.error("[PartnerRoutes] PATCH /admin/records/:userId error:", err);
    return res.status(500).json({ error: "Failed to update partner record" });
  }
});

// ─── Admin: GET /api/partner/admin/users/search ───────────────────────────────
router.get("/admin/users/search", requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ users: [] });
    const results = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(
        or(
          ilike(users.email, `%${q}%`),
          ilike(users.firstName as any, `%${q}%`),
          ilike(users.lastName as any, `%${q}%`)
        )
      )
      .limit(10);
    return res.json({ users: results });
  } catch (err) {
    console.error("[PartnerRoutes] GET /admin/users/search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

// ─── Admin: GET /api/partner/admin/users/:userId/record ──────────────────────
router.get("/admin/users/:userId/record", requireAuth, requireAdmin, async (req, res) => {
  try {
    const record = await getRecord(req.params.userId);
    if (!record) return res.json({ partner: null });
    const log = await getActivityLog(req.params.userId);
    return res.json(lifecycleResponse(record, log));
  } catch (err) {
    console.error("[PartnerRoutes] GET /admin/users/:userId/record error:", err);
    return res.status(500).json({ error: "Failed to load record" });
  }
});

// ─── Admin: GET /api/partner/admin/users/:userId/activity-log ────────────────
router.get("/admin/users/:userId/activity-log", requireAuth, requireAdmin, async (req, res) => {
  try {
    const log = await getActivityLog(req.params.userId);
    return res.json({ log });
  } catch (err) {
    console.error("[PartnerRoutes] GET activity-log error:", err);
    return res.status(500).json({ error: "Failed to load activity log" });
  }
});

// ─── Admin: POST /api/partner/admin/create ───────────────────────────────────
// Creates a partner record for an EXISTING user. Rejects duplicates.
router.post("/admin/create", requireAuth, requireAdmin, async (req, res) => {
  const actor = actorId(req as AuthenticatedRequest);
  try {
    const { userId, partnerName, partnerTypes, commissionRate, commissionMonths, customerDiscount, notes } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!partnerTypes?.length) return res.status(400).json({ error: "At least one capability is required" });

    const existing = await getRecord(userId);
    if (existing) return res.status(409).json({ error: "A partner record already exists for this user" });

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(partnerRecords)
        .values({
          userId,
          partnerName: partnerName ?? null,
          partnerTypes: partnerTypes ?? [],
          commissionRate: commissionRate ?? null,
          commissionMonths: commissionMonths ?? null,
          customerDiscount: customerDiscount ?? null,
          status: "active",
          notes: notes ?? null,
        })
        .returning();

      await tx.insert(partnerActivityLog).values({
        userId,
        actorId: actor,
        action: "partner_created",
        details: { partnerName, partnerTypes, commissionRate, commissionMonths, customerDiscount },
      });

      return created;
    });

    const log = await getActivityLog(userId);
    return res.json(lifecycleResponse(result, log));
  } catch (err) {
    console.error("[PartnerRoutes] POST /admin/create error:", err);
    return res.status(500).json({ error: "Failed to create partner" });
  }
});

// ─── Lifecycle action factory ─────────────────────────────────────────────────
// Each action validates the current state, updates the record, and writes the
// activity log — all in a single DB transaction.

async function lifecycleAction(
  req: AuthenticatedRequest,
  res: any,
  options: {
    action: string;
    logLabel: string;
    /** Field that must be null for this action to proceed (duplicate prevention) */
    requireNull: string;
    /** Fields to set on the partner record */
    setFields: (body: Record<string, unknown>) => Record<string, unknown>;
    /** Extra details to log */
    logDetails?: (body: Record<string, unknown>, record: any) => Record<string, unknown>;
    /** Optional extra body validation — return error string or null */
    validate?: (body: Record<string, unknown>) => string | null;
  }
) {
  const actor = actorId(req);
  const { userId } = req.params;

  try {
    const existing = await getRecord(userId);
    if (!existing) return res.status(404).json({ error: "Partner record not found" });

    // Validate not already done (prevent duplicate transitions)
    const alreadyDone = (existing as Record<string, unknown>)[options.requireNull] != null;
    if (alreadyDone) {
      return res.status(409).json({ error: `'${options.logLabel}' has already been completed` });
    }

    // Optional extra validation
    if (options.validate) {
      const err = options.validate(req.body);
      if (err) return res.status(400).json({ error: err });
    }

    const updates = { ...options.setFields(req.body), updatedAt: new Date() };
    const logDetails = options.logDetails ? options.logDetails(req.body, existing) : {};

    const updated = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(partnerRecords)
        .set(updates as any)
        .where(eq(partnerRecords.userId, userId))
        .returning();

      await tx.insert(partnerActivityLog).values({
        userId,
        actorId: actor,
        action: options.action,
        details: logDetails,
      });

      return record;
    });

    const log = await getActivityLog(userId);
    return res.json(lifecycleResponse(updated, log));
  } catch (err: any) {
    if (err?.status) return res; // already responded
    console.error(`[PartnerRoutes] ${options.action} error:`, err);
    return res.status(500).json({ error: "Action failed" });
  }
}

// ─── Admin: POST /api/partner/admin/users/:userId/approve ────────────────────
router.post("/admin/users/:userId/approve", requireAuth, requireAdmin, (req, res) =>
  lifecycleAction(req as AuthenticatedRequest, res, {
    action: "agreement_accepted",
    logLabel: "Agreement Accepted",
    requireNull: "acceptedAt",
    setFields: () => ({ acceptedAt: new Date() }),
  })
);

// ─── Admin: POST /api/partner/admin/users/:userId/connect-rewardful ──────────
router.post("/admin/users/:userId/connect-rewardful", requireAuth, requireAdmin, (req, res) =>
  lifecycleAction(req as AuthenticatedRequest, res, {
    action: "rewardful_connected",
    logLabel: "Rewardful Connected",
    requireNull: "rewardfulCreatedAt",
    validate: (body) => (body.rewardfulAffiliateId ? null : "rewardfulAffiliateId is required"),
    setFields: (body) => ({
      rewardfulAffiliateId: body.rewardfulAffiliateId as string,
      rewardfulCreatedAt: body.rewardfulCreatedAt ? new Date(body.rewardfulCreatedAt as string) : new Date(),
    }),
    logDetails: (body) => ({ rewardfulAffiliateId: body.rewardfulAffiliateId }),
  })
);

// ─── Admin: POST /api/partner/admin/users/:userId/assign-promo ───────────────
router.post("/admin/users/:userId/assign-promo", requireAuth, requireAdmin, (req, res) =>
  lifecycleAction(req as AuthenticatedRequest, res, {
    action: "promo_assigned",
    logLabel: "Promo Code Assigned",
    requireNull: "promoCodeAssignedAt",
    validate: (body) => (body.promoCode ? null : "promoCode is required"),
    setFields: (body) => ({
      promoCode: String(body.promoCode).toUpperCase(),
      promoCodeAssignedAt: new Date(),
      ...(body.customerDiscount != null ? { customerDiscount: Number(body.customerDiscount) } : {}),
      ...(body.stripePromotionCodeId ? { stripePromotionCodeId: body.stripePromotionCodeId as string } : {}),
    }),
    logDetails: (body) => ({ promoCode: body.promoCode, customerDiscount: body.customerDiscount }),
  })
);

// ─── Admin: POST /api/partner/admin/users/:userId/activate-org ───────────────
router.post("/admin/users/:userId/activate-org", requireAuth, requireAdmin, (req, res) =>
  lifecycleAction(req as AuthenticatedRequest, res, {
    action: "org_activated",
    logLabel: "Organization Activated",
    requireNull: "orgActivatedAt",
    setFields: () => ({ orgActivatedAt: new Date() }),
  })
);

// ─── Admin: POST /api/partner/admin/users/:userId/payouts-ready ──────────────
router.post("/admin/users/:userId/payouts-ready", requireAuth, requireAdmin, (req, res) =>
  lifecycleAction(req as AuthenticatedRequest, res, {
    action: "payouts_ready",
    logLabel: "Managed Payouts Ready",
    requireNull: "managedPayoutsAt",
    setFields: () => ({ managedPayoutsAt: new Date() }),
  })
);

// ─── Admin: POST /api/partner/admin/users/:userId/go-live ────────────────────
router.post("/admin/users/:userId/go-live", requireAuth, requireAdmin, (req, res) =>
  lifecycleAction(req as AuthenticatedRequest, res, {
    action: "campaign_live",
    logLabel: "Campaign Live",
    requireNull: "campaignActiveAt",
    setFields: () => ({ campaignActiveAt: new Date() }),
  })
);

export default router;
