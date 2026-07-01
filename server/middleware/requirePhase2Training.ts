import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest } from "./requireAuth";

/**
 * requirePhase2Training — ProCare Studio gate (Phase 2 ProCare Training)
 *
 * Blocks ProCare Studio and client-management API routes until the professional
 * has completed Phase 2 ProCare Training (users.procare_training_completed = true).
 *
 * Gate is skipped for:
 * - Unauthenticated users (requireAuth handles that)
 * - Non-professional users (no professionalRole set)
 * - When PHASE2_GATE_ENABLED env var is not set to "true" (pre-launch mode)
 *
 * Must be used alongside requirePhase1Cert (or after it) for full Studio gating.
 *
 * Launch sequence:
 *  1. Deploy — grandfather migration auto-runs, setting procareTrainingCompleted=true
 *     for all professionals with a completed Phase 1 cert.
 *  2. Ship Phase 2 training content.
 *  3. Set PHASE2_GATE_ENABLED=true — only professionals who haven't taken Phase 2
 *     (i.e., anyone who joined after the migration ran) will be blocked.
 */
export async function requirePhase2Training(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Gate is off until explicitly enabled — mirrors the BILLING_ENFORCED pattern.
  // While unset/false everyone passes; flip to "true" when Phase 2 content is live.
  if (process.env.PHASE2_GATE_ENABLED !== "true") {
    next();
    return;
  }

  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const [userRow] = await db
      .select({
        professionalRole: users.professionalRole,
        procareTrainingCompleted: users.procareTrainingCompleted,
      })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    // Non-professional users (regular users, clients) pass through unaffected
    if (!userRow?.professionalRole) {
      next();
      return;
    }

    if (!userRow?.procareTrainingCompleted) {
      res.status(403).json({
        error: "PHASE2_TRAINING_REQUIRED",
        message:
          "ProCare Studio access requires Phase 2 ProCare Training completion. Visit /pro-launchpad to continue.",
        redirectTo: "/pro-launchpad",
      });
      return;
    }

    next();
  } catch (err) {
    console.error("[requirePhase2Training] Error checking training status:", err);
    // Fail open on DB errors so certified professionals are not locked out
    next();
  }
}
