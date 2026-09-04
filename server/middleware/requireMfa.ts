/**
 * requireMfa — centralized per-session MFA gate for privileged authority
 *
 * Applied to ProCare / studio / tablet routes. Checks:
 * Privileged principals (founders, system admins, active business owners/admins,
 * and clinical professionals) must be enrolled and have completed the MFA
 * challenge in this session. Consumers are deliberately outside this policy.
 *
 * Authority is derived from the database for every request. In particular, do
 * not use the session's historical role or tester label: a role/membership
 * removal must take effect before the next privileged operation.
 *
 * SECURITY — FAIL CLOSED: A DB error must never silently pass clinical access
 * through. If the MFA check cannot complete, this middleware returns 503 so the
 * caller knows the auth service is temporarily unavailable rather than bypassed.
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { businessMembers, businesses } from "../db/schema/business";
import { and, eq, or } from "drizzle-orm";
import { logAudit, getClientIp } from "../lib/auditLog";
import type { AuthenticatedRequest } from "./requireAuth";
import { isMfaVerifiedForUser } from "../lib/sessionSecurity";
import { requiresPrivilegedMfa } from "../lib/privilegedMfaPolicy";

export async function requireMfa(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) { next(); return; }

  try {
    const [row] = await db
      .select({
        mfaEnabled: users.mfaEnabled,
        isFounder: users.isFounder,
        isAdmin: users.isAdmin,
        role: users.role,
        professionalRole: users.professionalRole,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) {
      res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }

    const [businessAuthority] = await db
      .select({
        isBusinessOwner: businesses.id,
        isBusinessAdmin: businessMembers.id,
      })
      .from(businesses)
      .leftJoin(
        businessMembers,
        and(
          eq(businessMembers.businessId, businesses.id),
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "active"),
          eq(businessMembers.role, "admin"),
        ),
      )
      .where(
        or(
          eq(businesses.ownerUserId, userId),
          eq(businessMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!requiresPrivilegedMfa({
      ...row,
      isBusinessOwner: businessAuthority?.isBusinessOwner != null,
      isBusinessAdmin: businessAuthority?.isBusinessAdmin != null,
    })) {
      next();
      return;
    }

    if (!row.mfaEnabled) {
      res.status(403).json({
        error: "Two-factor authentication must be enabled to access privileged tools.",
        code: "MFA_ENROLLMENT_REQUIRED",
      });
      return;
    }

    if (!isMfaVerifiedForUser(req, userId) && (req as any).bearerMfaVerified !== true) {
      res.status(403).json({
        error: "Two-factor authentication verification required for this session.",
        code: "MFA_REQUIRED",
      });
      return;
    }

    next();
  } catch (err) {
    // FAIL CLOSED — never call next() when identity cannot be verified.
    // Log the failure and return 503 so the caller retries rather than proceeds.
    process.stderr.write(
      `[requireMfa] DB error — failing CLOSED for user ${userId}: ${(err as any)?.message ?? String(err)}\n`
    );
    logAudit({
      actor: userId,
      action: "MFA_CHALLENGE_FAILED",
      resourceType: "auth",
      route: req.path,
      ip: getClientIp(req as any),
      meta: { reason: "mfa_db_error", failClosed: true },
    });
    res.status(503).json({
      error: "Authentication service temporarily unavailable. Please try again.",
      code: "MFA_SERVICE_UNAVAILABLE",
    });
  }
}
