import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import type { AuthenticatedRequest } from "./requireAuth";
import { isMfaVerifiedForUser } from "../lib/sessionSecurity";
import type { IdentityReviewerProof } from "../services/professionalIdentityDecisionService";

export async function requireProfessionalIdentityReviewer(req: Request, res: Response, next: NextFunction) {
  const id = (req as AuthenticatedRequest).authUser?.id;
  if (!id) return res.status(401).json({ code: "AUTH_REQUIRED", error: "Authentication required." });
  try {
    const [actor] = await db.select({ isAdmin: users.isAdmin, mfaEnabled: users.mfaEnabled, version: users.authSecurityVersion }).from(users).where(eq(users.id, id)).limit(1);
    if (!actor?.isAdmin) return res.status(403).json({ code: "REVIEWER_REQUIRED", error: "Administrative reviewer authority is required." });
    // New identity decisions require MFA for EVERY reviewer, not only accounts
    // on the older centralized allowlist. Native reviewer decisions are not
    // enabled in this stage; a current browser session is required.
    const version = req.session?.authSecurityVersion;
    if (!actor.mfaEnabled || !isMfaVerifiedForUser(req, id) || version !== actor.version) {
      return res.status(403).json({ code: "REVIEWER_MFA_REQUIRED", error: "Enable MFA and sign in with a current MFA-verified browser session." });
    }
    (req as Request & { identityReviewer: IdentityReviewerProof }).identityReviewer = { id, securityVersion: actor.version, mfaVerified: true };
    next();
  } catch {
    return res.status(503).json({ code: "REVIEWER_SECURITY_UNAVAILABLE", error: "Reviewer security could not be verified. No decision was applied." });
  }
}
