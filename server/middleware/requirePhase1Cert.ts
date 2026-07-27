import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { userCertifications } from "../db/schema/certifications";
import { eq, and, isNotNull } from "drizzle-orm";
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
 * - Members of an org with requireAcademy: false (org policy bypass)
 */

/** False-wins: returns false if any org the user belongs to has requireAcademy: false */
async function isAcademyRequired(userId: string): Promise<boolean> {
  try {
    const { loadOrgContext } = await import("../lib/orgContext");
    const { businesses, businessMembers } = await import("../db/schema/business");

    // 1. Check users.organizationId (white-label / clinical tenant)
    const [userRow] = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow?.organizationId) {
      const org = await loadOrgContext(userRow.organizationId);
      if (org.featureFlags.requireAcademy === false) return false;
    }

    // 2. Check active business memberships — false-wins: any org that waives = waived
    const memberships = await db
      .select({ organizationId: businesses.organizationId })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "active"),
          isNotNull(businesses.organizationId)
        )
      );

    for (const m of memberships) {
      if (m.organizationId) {
        const org = await loadOrgContext(m.organizationId);
        if (org.featureFlags.requireAcademy === false) return false;
      }
    }

    return true; // default: require academy
  } catch {
    return true; // fail safe on errors — do not inadvertently bypass
  }
}

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

  // Admin accounts bypass all certification gates
  if (authUser.isAdmin) {
    next();
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

    // Org policy bypass: if the user's org has waived the Academy requirement, skip the gate
    const academyRequired = await isAcademyRequired(authUser.id);
    if (!academyRequired) {
      next();
      return;
    }

    // Check Phase 1 certification — "platform" is the ProCare professional
    // training certification (distinct from Platform Mastery Academy).
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
