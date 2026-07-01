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
 *
 * Must be used alongside requirePhase1Cert (or after it) for full Studio gating.
 */
export async function requirePhase2Training(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
