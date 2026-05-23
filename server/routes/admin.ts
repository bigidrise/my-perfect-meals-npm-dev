import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { mealImageCache } from "../db/schema/mealImageCache";
import { eq, ilike, or, desc, notLike, and } from "drizzle-orm";
import { AuthenticatedRequest } from "../middleware/requireAuth";

const S3_BUCKET = process.env.S3_BUCKET_NAME || "my-perfect-meals-images";
const S3_URL_PREFIX = `https://${S3_BUCKET}.s3.`;

const router = Router();

const SAFE_USER_FIELDS = {
  id: users.id,
  email: users.email,
  username: users.username,
  firstName: users.firstName,
  lastName: users.lastName,
  plan: users.plan,
  subscriptionPlan: users.subscriptionPlan,
  subscriptionStatus: users.subscriptionStatus,
  subscriptionExpiresAt: users.subscriptionExpiresAt,
  stripeCustomerId: users.stripeCustomerId,
  stripeSubscriptionId: users.stripeSubscriptionId,
  role: users.role,
  isAdmin: users.isAdmin,
  isTester: users.isTester,
  isFounder: users.isFounder,
  isProCare: users.isProCare,
  onboardingCompletedAt: users.onboardingCompletedAt,
  safetyPinHash: users.safetyPinHash,
  safetyPinSetAt: users.safetyPinSetAt,
  createdAt: users.createdAt,
  authTokenCreatedAt: users.authTokenCreatedAt,
  trialStartedAt: users.trialStartedAt,
  trialEndsAt: users.trialEndsAt,
  medicalConditions: users.medicalConditions,
  healthConditions: users.healthConditions,
  specialtyCondition: users.specialtyCondition,
  oncologySupportIntent: users.oncologySupportIntent,
  needsProfessionalFollowup: users.needsProfessionalFollowup,
  professionalRole: users.professionalRole,
  activeBoard: users.activeBoard,
  macrosDefined: users.macrosDefined,
  entitlements: users.entitlements,
  planLookupKey: users.planLookupKey,
};

router.get("/users/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) {
    return res.json({ users: [] });
  }

  try {
    const results = await db
      .select(SAFE_USER_FIELDS)
      .from(users)
      .where(or(ilike(users.email, `%${q}%`), ilike(users.username, `%${q}%`)))
      .orderBy(desc(users.createdAt))
      .limit(20);

    return res.json({ users: results });
  } catch (err) {
    console.error("[admin] user search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

router.get("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const [user] = await db
      .select(SAFE_USER_FIELDS)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("[admin] get user error:", err);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/users/:userId/complete-onboarding", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  try {
    await db
      .update(users)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(users.id, userId));
    console.log(`[admin] complete-onboarding: userId=${userId} by admin=${actor.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin] complete-onboarding error:", err);
    return res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

router.post("/users/:userId/reset-onboarding", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  try {
    await db
      .update(users)
      .set({ onboardingCompletedAt: null })
      .where(eq(users.id, userId));
    console.log(`[admin] reset-onboarding: userId=${userId} by admin=${actor.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin] reset-onboarding error:", err);
    return res.status(500).json({ error: "Failed to reset onboarding" });
  }
});

router.post("/users/:userId/reset-pin", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  try {
    await db
      .update(users)
      .set({ safetyPinHash: null, safetyPinSetAt: null })
      .where(eq(users.id, userId));
    console.log(`[admin] reset-pin: userId=${userId} by admin=${actor.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin] reset-pin error:", err);
    return res.status(500).json({ error: "Failed to reset PIN" });
  }
});

router.post("/users/:userId/force-logout", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  try {
    const crypto = require("crypto");
    const newToken = crypto.randomBytes(32).toString("hex");
    await db
      .update(users)
      .set({ authToken: newToken, authTokenCreatedAt: new Date() })
      .where(eq(users.id, userId));
    console.log(`[admin] force-logout: userId=${userId} by admin=${actor.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin] force-logout error:", err);
    return res.status(500).json({ error: "Failed to force logout" });
  }
});

router.post("/users/:userId/refresh-subscription", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  try {
    const [user] = await db
      .select({ stripeCustomerId: users.stripeCustomerId, stripeSubscriptionId: users.stripeSubscriptionId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    console.log(`[admin] refresh-subscription requested: userId=${userId} stripeCustomer=${user.stripeCustomerId} by admin=${actor.email}`);
    return res.json({ ok: true, note: "Subscription data logged. Stripe webhook sync should re-sync entitlements automatically." });
  } catch (err) {
    console.error("[admin] refresh-subscription error:", err);
    return res.status(500).json({ error: "Failed to refresh subscription" });
  }
});

router.post("/users/:userId/grant-founder", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  try {
    await db
      .update(users)
      .set({ isFounder: true, isTester: false })
      .where(eq(users.id, userId));
    console.log(`[admin] grant-founder: userId=${userId} by admin=${actor.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin] grant-founder error:", err);
    return res.status(500).json({ error: "Failed to grant founder access" });
  }
});

router.post("/users/:userId/revoke-founder", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  try {
    await db
      .update(users)
      .set({ isFounder: false })
      .where(eq(users.id, userId));
    console.log(`[admin] revoke-founder: userId=${userId} by admin=${actor.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin] revoke-founder error:", err);
    return res.status(500).json({ error: "Failed to revoke founder access" });
  }
});

router.post("/users/:userId/disable", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  if (userId === actor.id) {
    return res.status(400).json({ error: "Cannot disable your own account" });
  }
  try {
    const crypto = require("crypto");
    const deadToken = `disabled_${crypto.randomBytes(16).toString("hex")}`;
    await db
      .update(users)
      .set({ authToken: deadToken, subscriptionStatus: "disabled" })
      .where(eq(users.id, userId));
    console.log(`[admin] disable: userId=${userId} by admin=${actor.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin] disable error:", err);
    return res.status(500).json({ error: "Failed to disable account" });
  }
});

router.post("/users/:userId/enable", async (req, res) => {
  const { userId } = req.params;
  const actor = (req as AuthenticatedRequest).authUser;
  try {
    const crypto = require("crypto");
    const newToken = crypto.randomBytes(32).toString("hex");
    await db
      .update(users)
      .set({ authToken: newToken, authTokenCreatedAt: new Date(), subscriptionStatus: "active" })
      .where(eq(users.id, userId));
    console.log(`[admin] enable: userId=${userId} by admin=${actor.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin] enable error:", err);
    return res.status(500).json({ error: "Failed to enable account" });
  }
});

/**
 * POST /api/admin/repair-image-cache
 *
 * Scans meal_image_cache for rows whose imageUrl is NOT an S3 URL
 * (i.e. ephemeral OpenAI/Azure URLs that have already expired or will soon).
 * Deletes those rows so the generator treats them as cache misses and
 * produces fresh permanent S3-backed images on next request.
 *
 * Safe to run at any time — only removes stale non-S3 entries.
 * Admin-only.
 */
router.post("/repair-image-cache", async (req, res) => {
  const actor = (req as AuthenticatedRequest).authUser;
  if (actor.role !== "admin" && !actor.entitlements?.includes("admin")) {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const staleRows = await db
      .select({ cacheKey: mealImageCache.cacheKey, mealName: mealImageCache.mealName, imageUrl: mealImageCache.imageUrl })
      .from(mealImageCache)
      .where(notLike(mealImageCache.imageUrl, `${S3_URL_PREFIX}%`));

    const staleKeys = staleRows.map(r => r.cacheKey);

    if (staleKeys.length === 0) {
      console.log("[admin/repair-image-cache] No stale entries found — cache is clean.");
      return res.json({ removed: 0, message: "Cache is clean — all entries are S3 URLs." });
    }

    for (const key of staleKeys) {
      await db.delete(mealImageCache).where(eq(mealImageCache.cacheKey, key));
    }

    console.log(`[admin/repair-image-cache] Removed ${staleKeys.length} stale entries by ${actor.email}`);
    return res.json({
      removed: staleKeys.length,
      meals: staleRows.map(r => ({ name: r.mealName, url: r.imageUrl.substring(0, 60) + "..." })),
    });
  } catch (err: any) {
    console.error("[admin/repair-image-cache] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
