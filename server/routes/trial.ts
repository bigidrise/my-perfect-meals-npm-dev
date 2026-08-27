/**
 * Trial Routes
 *
 * GET  /api/trial/status        — canonical server-authoritative trial status for the logged-in user
 * POST /api/admin/trial-grant   — admin/clinic: grant an extended trial to any user (audit-logged)
 */
import { Router } from "express";
import { db } from "../db";
import { trialAccessInvites, users } from "@shared/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { TRIAL_UNLOCKS_TIER } from "../../shared/planFeatures";
import { logAudit } from "../lib/auditLog";
import { sendTrialStartEmail } from "../services/emailService";
import {
  normalizeEmailIdentity,
  resolveEmailIdentityForEmail,
} from "../services/emailIdentityService";
import type { TrialAccessType } from "../services/preRegistrationAccess";

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────

function computeTrialStatus(user: {
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  trialSource?: string | null;
  trialAccessType?: TrialAccessType | null;
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
    trialAccessType: user.trialAccessType ?? null,
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
        trialAccessType: users.trialAccessType,
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

// ── Pre-registration access allowlist ───────────────────────────────────────

router.get("/admin/pre-registrations", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(trialAccessInvites)
      .orderBy(desc(trialAccessInvites.invitedAt));
    return res.json({ invitations: rows });
  } catch (err) {
    console.error("[trial] GET /admin/pre-registrations error:", err);
    return res.status(500).json({ error: "Failed to load pre-registration access" });
  }
});

router.post("/admin/pre-registrations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const invitedByUserId = (req as AuthenticatedRequest).authUser.id;
    const email = typeof req.body?.email === "string"
      ? normalizeEmailIdentity(req.body.email)
      : "";
    const accessType = req.body?.accessType as TrialAccessType;
    const durationDays = req.body?.durationDays ?? 30;
    const notes = typeof req.body?.notes === "string"
      ? req.body.notes.trim().slice(0, 1000) || null
      : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (accessType !== "pilot" && accessType !== "client") {
      return res.status(400).json({ error: "accessType must be pilot or client" });
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
      return res.status(400).json({ error: "durationDays must be between 1 and 365" });
    }

    const identity = await resolveEmailIdentityForEmail(email);
    if (identity.status !== "not_found") {
      return res.status(409).json({
        error: "This email already has an account. Use the existing-user trial grant instead.",
      });
    }

    const [existingPending] = await db
      .select({ id: trialAccessInvites.id })
      .from(trialAccessInvites)
      .where(and(
        eq(trialAccessInvites.normalizedEmail, email),
        isNull(trialAccessInvites.activatedAt),
        isNull(trialAccessInvites.revokedAt),
      ))
      .limit(1);
    if (existingPending) {
      return res.status(409).json({ error: "This email already has pending pre-registration access" });
    }

    const [invitation] = await db
      .insert(trialAccessInvites)
      .values({
        normalizedEmail: email,
        accessType,
        durationDays,
        invitedByUserId,
        notes,
      })
      .returning();

    logAudit({
      actor: invitedByUserId,
      action: "WRITE",
      resourceType: "trial_pre_registration",
      resourceId: invitation.id,
      route: "/api/trial/admin/pre-registrations",
      meta: { accessType, durationDays },
    });

    return res.status(201).json({ invitation });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "This email already has pending pre-registration access" });
    }
    console.error("[trial] POST /admin/pre-registrations error:", err);
    return res.status(500).json({ error: "Failed to create pre-registration access" });
  }
});

router.delete("/admin/pre-registrations/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const actorId = (req as AuthenticatedRequest).authUser.id;
    const [revoked] = await db
      .update(trialAccessInvites)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(trialAccessInvites.id, req.params.id),
        isNull(trialAccessInvites.activatedAt),
        isNull(trialAccessInvites.revokedAt),
      ))
      .returning({ id: trialAccessInvites.id });

    if (!revoked) {
      return res.status(404).json({ error: "Pending pre-registration access not found" });
    }

    logAudit({
      actor: actorId,
      action: "WRITE",
      resourceType: "trial_pre_registration",
      resourceId: revoked.id,
      route: "/api/trial/admin/pre-registrations/:id",
      meta: { revoked: true },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[trial] DELETE /admin/pre-registrations/:id error:", err);
    return res.status(500).json({ error: "Failed to revoke pre-registration access" });
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
        trialAccessType: users.trialAccessType,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Send trial-start confirmation email (non-fatal — grant is already committed).
    // Use the effective trialEndsAt from the DB (GREATEST may have preserved a
    // later pre-existing end date), and compute days from now to that date.
    if (targetUser.email && updated) {
      const effectiveEndsAt: Date = (updated as any).trialEndsAt
        ? new Date((updated as any).trialEndsAt)
        : trialEndsAt;
      const effectiveDays = Math.max(
        1,
        Math.ceil((effectiveEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      sendTrialStartEmail({
        to: targetUser.email,
        userName: targetUser.email.split('@')[0],
        trialSource,
        durationDays: effectiveDays,
        trialEndsAt: effectiveEndsAt,
      }).catch((err) =>
        console.error('[trial] Trial start email failed (non-fatal):', err)
      );
    }

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
