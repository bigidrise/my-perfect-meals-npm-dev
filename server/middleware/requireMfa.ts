/**
 * requireMfa — centralized per-session MFA gate for designated accounts
 *
 * Applied to ProCare / studio / tablet routes. Checks:
 * Accounts explicitly designated by the central MFA policy must be enrolled
 * and have completed the MFA challenge in this session.
 *
 * Identity is derived from the database for every request rather than trusting
 * a historical email or role stored in the session.
 *
 * SECURITY — FAIL CLOSED: A DB error must never silently pass clinical access
 * through. If the MFA check cannot complete, this middleware returns 503 so the
 * caller knows the auth service is temporarily unavailable rather than bypassed.
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
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
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) {
      res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }

    if (!requiresPrivilegedMfa({ email: row.email })) {
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
