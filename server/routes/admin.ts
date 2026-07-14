import { Router } from "express";
import { db, pool } from "../db";
import { users } from "@shared/schema";
import { mealImageCache } from "../db/schema/mealImageCache";
import { userCertifications, waitlistRecoveryEvents } from "../db/schema/certifications";
import { eq, ilike, or, desc, notLike, and, isNull, isNotNull, sql, min, max } from "drizzle-orm";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { sendMarketingCoachingEnrollmentEmail } from "../services/emailService";
import { requireEmailService } from "../middleware/requireEmailService";

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
  procareTrainingCompleted: users.procareTrainingCompleted,
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

  // Acquire cross-instance advisory lock to prevent concurrent repair runs
  const lockResult = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${REPAIR_IMAGE_CACHE_LOCK_KEY}) AS acquired`
  );
  if (!lockResult.rows[0]?.acquired) {
    return res.status(409).json({ error: "A cache repair job is already in progress. Please wait for it to finish." });
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
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${REPAIR_IMAGE_CACHE_LOCK_KEY})`).catch((e) =>
      console.error("[admin/repair-image-cache] advisory unlock failed:", e)
    );
  }
});

router.get("/grandfather-migration-status", async (req, res) => {
  try {
    // One row per user — matches the grandfather migration's unique-user semantics.
    // DISTINCT ON picks the earliest qualifying cert per user (ORDER BY u.id, uc.completed_at ASC).
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (u.id)
        u.id,
        u.email,
        u.username,
        u.professional_role AS "professionalRole",
        u.procare_training_completed AS "procareTrainingCompleted",
        uc.certification_type AS "certificationType",
        uc.completed_at AS "certCompletedAt"
      FROM users u
      JOIN user_certifications uc ON uc.user_id = u.id
      WHERE
        u.procare_training_completed = true
        AND u.professional_role IS NOT NULL
        AND uc.certification_type IN ('platform', 'affiliate_coaching')
        AND uc.completed_at IS NOT NULL
        AND uc.completed_at < '2026-07-01T00:00:00Z'
      ORDER BY u.id, uc.completed_at ASC
    `);
    const professionals = (rows as any).rows ?? (Array.isArray(rows) ? rows : []);
    return res.json({
      ok: true,
      count: professionals.length,
      professionals,
    });
  } catch (err: any) {
    console.error("[admin/grandfather-migration-status] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/run-grandfather-migration", async (req, res) => {
  const actor = (req as AuthenticatedRequest).authUser;

  // Acquire cross-instance advisory lock to prevent concurrent migration runs
  const lockResult = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${GRANDFATHER_MIGRATION_LOCK_KEY}) AS acquired`
  );
  if (!lockResult.rows[0]?.acquired) {
    return res.status(409).json({ error: "A grandfather migration is already in progress. Please wait for it to finish." });
  }

  try {
    const result = await db.execute(sql`
      UPDATE users
      SET procare_training_completed = true
      WHERE
        professional_role IS NOT NULL
        AND procare_training_completed = false
        AND id IN (
          SELECT user_id FROM user_certifications
          WHERE certification_type IN ('platform', 'affiliate_coaching')
            AND completed_at IS NOT NULL
            AND completed_at < '2026-07-01T00:00:00Z'
        )
    `);
    const rowCount = (result as any).rowCount ?? (result as any).count ?? 0;
    console.log(`✅ [admin/run-grandfather-migration] ${rowCount} professional(s) grandfathered (procare_training_completed=true) — triggered by ${actor.email}`);
    return res.json({
      ok: true,
      rowsUpdated: rowCount,
      message: `Grandfather migration complete: ${rowCount} professional(s) updated.`,
    });
  } catch (err: any) {
    console.error("[admin/run-grandfather-migration] error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${GRANDFATHER_MIGRATION_LOCK_KEY})`).catch((e) =>
      console.error("[admin/run-grandfather-migration] advisory unlock failed:", e)
    );
  }
});

// ─── MARKETING & COACHING WAITLIST NOTIFICATION ───────────────────────────────

// GET /admin/certifications/marketing-coaching/waitlist-stats
// Returns the total waitlisted count, a preview of up to 20 email addresses,
// and the oldest/newest entry timestamps — read-only, no emails sent.
router.get("/certifications/marketing-coaching/waitlist-stats", async (req, res) => {
  try {
    const PREVIEW_LIMIT = 20;

    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        notified: sql<number>`count(*) filter (where ${userCertifications.notifiedAt} is not null)::int`,
        oldestEntry: min(userCertifications.createdAt),
        newestEntry: max(userCertifications.createdAt),
      })
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.certificationType, "marketing_coaching"),
          eq(userCertifications.status, "waitlisted")
        )
      );

    const preview = await db
      .select({ email: users.email })
      .from(userCertifications)
      .innerJoin(users, eq(users.id, userCertifications.userId))
      .where(
        and(
          eq(userCertifications.certificationType, "marketing_coaching"),
          eq(userCertifications.status, "waitlisted")
        )
      )
      .orderBy(userCertifications.createdAt)
      .limit(PREVIEW_LIMIT);

    const total = stats?.total ?? 0;
    const notified = stats?.notified ?? 0;

    return res.json({
      total,
      notified,
      pending: total - notified,
      oldestEntry: stats?.oldestEntry ?? null,
      newestEntry: stats?.newestEntry ?? null,
      previewEmails: preview.map((r) => r.email).filter(Boolean),
    });
  } catch (err: any) {
    console.error("[admin/waitlist-stats] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /admin/certifications/marketing-coaching/waitlist
// Returns all waitlisted users for marketing_coaching, including notifiedAt and emailSentAt status.
// notifiedAt = when the row was claimed for sending; emailSentAt = when the email was confirmed sent.
// A row with notifiedAt set but emailSentAt NULL indicates an in-progress or orphaned send attempt.
router.get("/certifications/marketing-coaching/waitlist", async (req, res) => {
  try {
    const rows = await db
      .select({
        userId: userCertifications.userId,
        email: users.email,
        firstName: users.firstName,
        username: users.username,
        status: userCertifications.status,
        notifiedAt: userCertifications.notifiedAt,
        emailSentAt: userCertifications.emailSentAt,
        createdAt: userCertifications.createdAt,
      })
      .from(userCertifications)
      .innerJoin(users, eq(userCertifications.userId, users.id))
      .where(
        and(
          eq(userCertifications.certificationType, "marketing_coaching"),
          eq(userCertifications.status, "waitlisted")
        )
      )
      .orderBy(desc(userCertifications.createdAt));

    return res.json({ ok: true, waitlist: rows });
  } catch (err: any) {
    console.error("[admin/waitlist] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /admin/certifications/marketing-coaching/recovery-events
// Returns all boot-recovery audit entries (newest first).
// Each entry records the timestamp, count of orphaned rows reset, and affected users (id, email, firstName).
router.get("/certifications/marketing-coaching/recovery-events", async (req, res) => {
  try {
    const events = await db
      .select({
        id: waitlistRecoveryEvents.id,
        recoveredAt: waitlistRecoveryEvents.recoveredAt,
        rowCount: waitlistRecoveryEvents.rowCount,
        userIds: waitlistRecoveryEvents.userIds,
      })
      .from(waitlistRecoveryEvents)
      .orderBy(desc(waitlistRecoveryEvents.recoveredAt))
      .limit(50);

    // Collect all unique user IDs across all events
    const allUserIds = [...new Set(events.flatMap((e) => (e.userIds as string[]) ?? []))];

    // Look up name + email for each affected user
    const userMap = new Map<string, { email: string; firstName: string | null }>();
    if (allUserIds.length > 0) {
      const rows = await db
        .select({ id: users.id, email: users.email, firstName: users.firstName })
        .from(users)
        .where(sql`${users.id}::text = ANY(ARRAY[${sql.join(allUserIds.map((id) => sql`${id}`), sql`, `)}])`);
      for (const row of rows) {
        userMap.set(String(row.id), { email: row.email, firstName: row.firstName ?? null });
      }
    }

    const enriched = events.map((evt) => ({
      id: evt.id,
      recoveredAt: evt.recoveredAt,
      rowCount: evt.rowCount,
      users: ((evt.userIds as string[]) ?? []).map((uid) => ({
        userId: uid,
        email: userMap.get(uid)?.email ?? null,
        firstName: userMap.get(uid)?.firstName ?? null,
      })),
    }));

    return res.json({ ok: true, events: enriched });
  } catch (err: any) {
    // 42P01 = "relation does not exist" — table not yet created by boot migration
    if (err?.code === "42P01") {
      return res.json({ ok: true, events: [] });
    }
    console.error("[admin/recovery-events] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/certifications/marketing-coaching/notify-waitlist
// Sends enrollment-open emails to every user with status='waitlisted' on marketing_coaching.
//
// Idempotency / concurrency safety — two-layer strategy:
//
//   Layer 1 — PostgreSQL advisory lock (cross-instance in-flight guard):
//     pg_try_advisory_lock(NOTIFY_WAITLIST_LOCK_KEY) is acquired at the start of every run.
//     Because this is a DB-level session lock it works across multiple server instances and
//     survives restarts (the lock is automatically released when the DB connection closes).
//     A second call — on any instance — receives a 409 immediately if a run is in progress.
//     The lock is released in the finally block via pg_advisory_unlock.
//
//   Layer 2 — Atomic row claim (duplicate-send guard, the authoritative safety net):
//     UPDATE … WHERE notified_at IS NULL RETURNING atomically stamps rows before any email
//     is sent. Even if two instances somehow both passed Layer 1 simultaneously, they would
//     claim disjoint sets of rows and no user would receive a duplicate email.
//
//   Additional guarantees:
//   - notified_at = claim timestamp (set before send); email_sent_at = confirmed-send timestamp (set after).
//   - If an individual send fails, notified_at is reset to NULL so the user can be retried.
//   - On server restart, boot startup resets notified_at for any rows where notified_at IS NOT NULL
//     AND email_sent_at IS NULL — rows claimed mid-send whose confirmation was never written.
//   - ?force=true re-claims ALL waitlisted rows (including already-notified) for genuine resends.
//
// Runs sequentially with a short delay between sends to respect Resend rate limits.

// ─── ADVISORY LOCK KEY REGISTRY ───────────────────────────────────────────────
// Each long-running admin job that does bulk mutations acquires a PostgreSQL
// session-level advisory lock via pg_try_advisory_lock(key) before doing any
// work. This prevents duplicate runs across multiple server instances.
//
// Keys are stable bigints chosen arbitrarily. They MUST be unique across the
// entire codebase. Document every new key here before use.
//
//  7_438_291_650  — notify-waitlist          (POST /certifications/marketing-coaching/notify-waitlist)
//  7_438_291_651  — repair-image-cache       (POST /repair-image-cache)
//  7_438_291_652  — grandfather-migration    (POST /run-grandfather-migration)
//  7_438_291_653  — seed-cert               (POST /admin/cert/seed/:certType  — adminCertRoutes.ts)
// ──────────────────────────────────────────────────────────────────────────────

const NOTIFY_WAITLIST_LOCK_KEY       = 7_438_291_650;
const REPAIR_IMAGE_CACHE_LOCK_KEY    = 7_438_291_651;
const GRANDFATHER_MIGRATION_LOCK_KEY = 7_438_291_652;

router.post("/certifications/marketing-coaching/notify-waitlist", requireEmailService, async (req, res) => {
  // ── Layer 1: acquire cross-instance advisory lock on a dedicated connection ─
  // Session-level advisory locks are tied to the PostgreSQL connection that
  // acquired them. Using a dedicated PoolClient (instead of the shared drizzle
  // pool) guarantees:
  //   • acquire and release always happen on the same connection, so the lock
  //     is never held by a recycled pool connection after the job ends.
  //   • client.release() in finally returns the connection to the pool, at
  //     which point PostgreSQL automatically drops all session-level advisory
  //     locks on that connection — even if the explicit pg_advisory_unlock was
  //     skipped due to an error or mid-job connection drop.
  const lockClient = await pool.connect();
  let lockAcquired = false;
  try {
    const lockResult = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [NOTIFY_WAITLIST_LOCK_KEY]
    );
    lockAcquired = lockResult.rows[0]?.acquired ?? false;
  } catch (e) {
    lockClient.release();
    throw e;
  }

  if (!lockAcquired) {
    lockClient.release();
    return res.status(409).json({ error: "A notify job is already in progress. Please wait for it to finish before sending again." });
  }

  const actor = (req as AuthenticatedRequest).authUser;
  const APP_URL = process.env.APP_URL || "https://app.myperfectmeals.com";
  const force = req.query.force === "true";
  const claimTime = new Date();

  try {
    // ── 1. Count total waitlisted (for skipped metric) ──────────────────────
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.certificationType, "marketing_coaching"),
          eq(userCertifications.status, "waitlisted")
        )
      );

    // ── 2. Atomically claim rows ─────────────────────────────────────────────
    // UPDATE returns only rows that were actually claimed by THIS call.
    // Concurrent calls will get 0 rows back for rows already stamped.
    const claimWhere = force
      ? and(
          eq(userCertifications.certificationType, "marketing_coaching"),
          eq(userCertifications.status, "waitlisted")
        )
      : and(
          eq(userCertifications.certificationType, "marketing_coaching"),
          eq(userCertifications.status, "waitlisted"),
          isNull(userCertifications.notifiedAt)
        );

    const claimed = await db
      .update(userCertifications)
      .set({ notifiedAt: claimTime })
      .where(claimWhere)
      .returning({ userId: userCertifications.userId });

    const skipped = (total ?? 0) - claimed.length;

    console.log(
      `[admin/notify-waitlist] ${total} waitlisted — ${claimed.length} claimed, ${skipped} skipped (already notified) — force=${force} — triggered by ${actor.email}`
    );

    if (claimed.length === 0) {
      return res.json({ ok: true, total: total ?? 0, sent: 0, skipped, failed: 0, failures: [] });
    }

    // ── 3. Fetch user details for claimed rows ───────────────────────────────
    const claimedIds = claimed.map((r) => r.userId);
    const userRows = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        username: users.username,
      })
      .from(users)
      .where(sql`${users.id} = ANY(${claimedIds})`);

    const userMap = new Map(userRows.map((u) => [u.userId, u]));

    // ── 4. Send emails; reset notified_at on failure so user can be retried ──
    let sent = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const { userId } of claimed) {
      const row = userMap.get(userId);
      if (!row?.email) {
        failed++;
        // Reset so a future run can retry
        await db
          .update(userCertifications)
          .set({ notifiedAt: null })
          .where(
            and(
              eq(userCertifications.userId, userId),
              eq(userCertifications.certificationType, "marketing_coaching")
            )
          );
        continue;
      }

      const userName = row.firstName || row.username || "there";
      const ok = await sendMarketingCoachingEnrollmentEmail({
        to: row.email,
        userName,
        appUrl: APP_URL,
      });

      if (ok) {
        sent++;
        // Stamp email_sent_at to confirm the email was actually delivered to the provider.
        // This separates "row claimed" (notified_at) from "email confirmed sent" (email_sent_at).
        // On a server restart mid-send, rows with notified_at set but email_sent_at NULL are
        // orphaned and will be reset to notified_at=NULL by the boot startup recovery step.
        await db
          .update(userCertifications)
          .set({ emailSentAt: new Date() })
          .where(
            and(
              eq(userCertifications.userId, userId),
              eq(userCertifications.certificationType, "marketing_coaching")
            )
          );
      } else {
        failed++;
        failures.push(row.email);
        // Reset so a future run can retry
        await db
          .update(userCertifications)
          .set({ notifiedAt: null })
          .where(
            and(
              eq(userCertifications.userId, userId),
              eq(userCertifications.certificationType, "marketing_coaching")
            )
          );
      }

      // Small delay to stay within Resend's rate limits
      await new Promise((r) => setTimeout(r, 150));
    }

    console.log(`[admin/notify-waitlist] Done. sent=${sent} skipped=${skipped} failed=${failed}`);
    return res.json({
      ok: true,
      total: total ?? 0,
      sent,
      skipped,
      failed,
      failures,
    });
  } catch (err: any) {
    console.error("[admin/notify-waitlist] error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    // Explicitly unlock first (belt-and-suspenders), then return the dedicated
    // connection to the pool. PostgreSQL automatically releases all session-level
    // advisory locks when a connection is closed/returned, so client.release()
    // alone is sufficient even if the explicit unlock fails (e.g. the connection
    // dropped mid-job).
    await lockClient
      .query("SELECT pg_advisory_unlock($1)", [NOTIFY_WAITLIST_LOCK_KEY])
      .catch((e) => console.error("[admin/notify-waitlist] advisory unlock failed:", e));
    lockClient.release();
  }
});

router.get("/config/email-status", (req, res) => {
  const configured = !!process.env.RESEND_API_KEY;
  return res.json({ configured });
});

export default router;
