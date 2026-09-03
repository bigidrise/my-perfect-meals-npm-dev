/**
 * requireMfa — per-session MFA gate for clinical roles
 *
 * Applied to ProCare / studio / tablet routes. Checks:
 *  1. If the user has mfa_enabled=true → they MUST have completed the MFA
 *     challenge in this session (session.mfaVerified === true).
 *  2. If MFA_REQUIRED_FOR_CLINICAL=true → unenrolled coach/admin users are
 *     blocked and must set up MFA before accessing clinical tools.
 *
 * Both checks are skipped for non-clinical roles (client).
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

// System roles with clinical access
const CLINICAL_SYSTEM_ROLES = new Set(["coach", "admin"]);
// ProCare professional roles — these carry role="client" in the users table
// but have the same clinical obligations and must be MFA-gated identically.
const CLINICAL_PROFESSIONAL_ROLES = new Set([
  "physician",
  "trainer",
  "dietitian",
  "nurse_practitioner",
]);

export async function requireMfa(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) { next(); return; }

  const role = authReq.authUser.role as string | undefined;
  const professionalRole = authReq.authUser.professionalRole as string | null | undefined;

  const isClinical =
    (role && CLINICAL_SYSTEM_ROLES.has(role)) ||
    (professionalRole != null && CLINICAL_PROFESSIONAL_ROLES.has(professionalRole));

  if (!isClinical) { next(); return; }

  try {
    const [row] = await db
      .select({ mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const mfaEnabled = row?.mfaEnabled ?? false;
    const mfaVerified = (req as any).session?.mfaVerified === true;

    if (mfaEnabled && !mfaVerified) {
      res.status(403).json({
        error: "Two-factor authentication verification required for this session.",
        code: "MFA_REQUIRED",
      });
      return;
    }

    if (process.env.MFA_REQUIRED_FOR_CLINICAL === "true" && !mfaEnabled) {
      res.status(403).json({
        error: "Two-factor authentication must be enabled to access clinical tools.",
        code: "MFA_ENROLLMENT_REQUIRED",
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
