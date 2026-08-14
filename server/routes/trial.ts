/**
 * Trial Routes
 *
 * GET  /api/trial/status        — canonical server-authoritative trial status for the logged-in user
 * POST /api/admin/trial-grant   — admin/clinic: grant an extended trial to any user (audit-logged)
 */
import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { TRIAL_UNLOCKS_TIER } from "../../shared/planFeatures";
import { logAudit } from "../lib/auditLog";

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────

function computeTrialStatus(user: {
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  trialSource?: string | null;
  planLookupKey?: string | null;
}) {
  const now = new Date();
  const trialEndsAt = user.trialEndsAt ?? null;
  const trialStartedAt = user.trialStartedAt ?? null;

  // Trial is only "active" when there is no paid plan superseding it
  const hasActivePaidPlan = !!user.planLookupKey;
  const isTrialActive =
    !hasActivePaidPlan &&
    trialEndsAt != null &&
    trialEndsAt > now;

  const msRemaining = isTrialActive ? trialEndsAt!.getTime() - now.getTime() : 0;
  const daysRemaining = isTrialActive ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : 0;

  return {
    isTrialActive,
    trialStartedAt: trialStartedAt?.toISOString() ?? null,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    daysRemaining,
    trialSource: user.trialSource ?? null,
    trialTier: isTrialActive ? TRIAL_UNLOCKS_TIER : null,
    expiresToTier: "free" as const,
  };
}

// ── GET /api/trial/status ──────────────────────────────────────────────────

router.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [user] = await db
      .select({
        trialStartedAt: users.trialStartedAt,
        trialEndsAt: users.trialEndsAt,
        planLookupKey: users.planLookupKey,
        trialSource: (users as any).trialSource,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json(computeTrialStatus(user as any));
  } catch (err) {
    console.error("[trial] GET /status error:", err);
    return res.status(500).json({ error: "Failed to fetch trial status" });
  }
});

// ── POST /api/admin/trial-grant ────────────────────────────────────────────

router.post("/admin/grant", requireAuth, requireAdmin, async (req, res) => {
  try {
    const grantedBy = (req as AuthenticatedRequest).authUser.id;
    const {
      userId,
      durationDays = 30,
      trialTier = TRIAL_UNLOCKS_TIER,
      expiresToTier = "free",
      trialSource = "admin_grant",
      notes,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const validSources = ["admin_grant", "clinic_grant", "promotion"];
    if (!validSources.includes(trialSource)) {
      return res.status(400).json({ error: `trialSource must be one of: ${validSources.join(", ")}` });
    }

    if (typeof durationDays !== "number" || durationDays < 1 || durationDays > 365) {
      return res.status(400).json({ error: "durationDays must be between 1 and 365" });
    }

    const [targetUser] = await db
      .select({ id: users.id, email: users.email, planLookupKey: users.planLookupKey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) return res.status(404).json({ error: "Target user not found" });

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Update user trial fields — only if this extends beyond any existing trial.
    // plan_lookup_key is intentionally left untouched: a trial grant must not
    // revoke an active paid subscription. The trial window simply activates
    // if/when the paid plan lapses.
    await db.execute(sql`
      UPDATE users
         SET trial_started_at    = COALESCE(trial_started_at, now()),
             trial_ends_at       = GREATEST(COALESCE(trial_ends_at, '1970-01-01'::timestamptz), ${trialEndsAt}::timestamptz),
             trial_source        = ${trialSource},
             subscription_status = 'active'
       WHERE id = ${userId}
    `);

    // Insert audit record in trial_grants
    await db.execute(sql`
      INSERT INTO trial_grants
        (user_id, granted_by_user_id, trial_source, trial_tier, expires_to_tier,
         trial_started_at, trial_ends_at, granted_at, notes)
      VALUES (
        ${userId}, ${grantedBy}, ${trialSource}, ${trialTier}, ${expiresToTier},
        now(), ${trialEndsAt}::timestamptz, now(), ${notes ?? null}
      )
    `);

    // Audit log — WRITE covers any admin-initiated data mutation
    logAudit({
      actor: grantedBy,
      action: "WRITE",
      resourceType: "trial",
      resourceId: userId,
      route: "/api/admin/trial-grant",
      meta: { durationDays, trialTier, trialSource, targetEmail: targetUser.email },
    });

    const [updated] = await db
      .select({
        trialStartedAt: users.trialStartedAt,
        trialEndsAt: users.trialEndsAt,
        planLookupKey: users.planLookupKey,
        trialSource: (users as any).trialSource,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return res.json({
      success: true,
      grantedTo: userId,
      ...computeTrialStatus(updated as any),
    });
  } catch (err) {
    console.error("[trial] POST /admin/grant error:", err);
    return res.status(500).json({ error: "Failed to grant trial" });
  }
});

// ── GET /api/admin/users/:id/trial-grants ──────────────────────────────────

router.get("/admin/users/:id/trial-grants", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "User id is required" });

    const rows = await db.execute(sql`
      SELECT
        tg.id,
        tg.granted_at,
        tg.trial_source,
        tg.trial_tier,
        tg.trial_ends_at,
        tg.notes,
        tg.is_superseded,
        granter.email AS granted_by_email
      FROM trial_grants tg
      LEFT JOIN users granter ON granter.id = tg.granted_by_user_id
      WHERE tg.user_id = ${id}
      ORDER BY tg.granted_at DESC
    `);

    return res.json({ grants: rows.rows });
  } catch (err) {
    console.error("[trial] GET /admin/users/:id/trial-grants error:", err);
    return res.status(500).json({ error: "Failed to fetch trial grant history" });
  }
});

export default router;
