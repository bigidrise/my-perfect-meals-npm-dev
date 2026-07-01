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
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "./requireAuth";

const CLINICAL_ROLES = new Set(["coach", "admin"]);

export async function requireMfa(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) { next(); return; }

  const role = (authReq.authUser as any).role as string | undefined;
  if (!role || !CLINICAL_ROLES.has(role)) { next(); return; }

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
    console.error("[requireMfa] DB lookup error:", err);
    next(); // fail-open to avoid blocking on transient DB errors
  }
}
