import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest } from "./requireAuth";
import { getAcademyProgression } from "../services/academyProgression";

/**
 * requirePhase2Training — ProCare Studio gate (Phase 2 ProCare Training)
 *
 * Blocks ProCare Studio and client-management API routes until the professional
 * has completed ProCare training according to authoritative Academy evidence.
 *
 * Gate is skipped for:
 * - Unauthenticated users (requireAuth handles that)
 * - Non-professional users (no professionalRole set)
 * - When PHASE2_GATE_ENABLED env var is not set to "true" (pre-launch mode)
 *
 * Must be used alongside requirePhase1Cert (or after it) for full Studio gating.
 *
 * Historical account booleans do not establish Academy evidence.
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

  // Admin accounts bypass all certification gates
  if (authUser.isAdmin) {
    next();
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
    if (!userRow) {
      res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }
    if (!userRow.professionalRole) {
      next();
      return;
    }

    const progression = await getAcademyProgression(authUser.id);
    if (!progression.proCare.complete) {
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
    res.status(503).json({ code: "ACADEMY_EVIDENCE_UNAVAILABLE", error: "Training evidence could not be verified. Please retry." });
  }
}
