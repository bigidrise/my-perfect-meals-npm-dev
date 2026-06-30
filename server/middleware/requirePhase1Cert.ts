import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { userCertifications } from "../db/schema/certifications";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest } from "./requireAuth";

/**
 * requirePhase1Cert — ProCare Studio gate (Phase 1 Academy)
 *
 * Blocks ProCare Studio and client-management API routes until the professional
 * has completed Phase 1 Academy certification (certificationType = "platform",
 * status = "completed", completedAt set).
 *
 * Gate is skipped for:
 * - Unauthenticated users (requireAuth handles that)
 * - Non-professional users (no professionalRole set)
 * - Existing certified professionals (completedAt already set — fully non-breaking)
 *
 * Approved gate language (Phase 1 of task spec):
 * "ProCare Studio access is locked until the professional has completed Phase 1
 * Academy certification and, if they are using ProCare to manage clients,
 * Phase 2 ProCare Training. Existing certified users remain unaffected."
 */
export async function requirePhase1Cert(
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
    // Only gate professionals (users with a professionalRole set)
    const [userRow] = await db
      .select({ professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    // Non-professional users (regular users, clients) pass through unaffected
    if (!userRow?.professionalRole) {
      next();
      return;
    }

    // Check Phase 1 (platform) certification
    const [cert] = await db
      .select({ status: userCertifications.status, completedAt: userCertifications.completedAt })
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.userId, authUser.id),
          eq(userCertifications.certificationType, "platform")
        )
      )
      .limit(1);

    const phase1Complete = cert?.status === "completed" && !!cert?.completedAt;

    if (!phase1Complete) {
      res.status(403).json({
        error: "PHASE1_CERT_REQUIRED",
        message:
          "ProCare Studio access is locked until you have completed Phase 1 Academy certification. Visit /pro-launchpad to continue.",
        redirectTo: "/pro-launchpad",
      });
      return;
    }

    next();
  } catch (err) {
    console.error("[requirePhase1Cert] Error checking certification:", err);
    // Fail open on DB errors so certified professionals are not locked out
    next();
  }
}
