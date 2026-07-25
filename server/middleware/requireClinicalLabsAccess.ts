import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { getTierForLookupKey } from "@shared/planFeatures";

/**
 * requireClinicalLabsAccess — stricter gate for Clinical Lab Values.
 *
 * Lab-value entry and Clinical Precision are paid Clinical-plan features only.
 *
 * Passes:  Clinical (ultimate) paid plan.
 * Note: sandbox accounts bypass only when BILLING_ENFORCED=false (pre-launch mode).
 * Blocks:  FREE, Essential (basic), Pro (premium), expired/cancelled Clinical.
 *
 * Ownership checks inside clinicalLabs.ts (verifyClinicalAccess) cover the
 * care-team case — a clinician accessing an assigned client's data.  That check
 * runs AFTER this middleware; this middleware is the subscription gate.
 *
 * When BILLING_ENFORCED=false (pre-launch), all users pass — same as other middleware.
 */

const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

export function requireClinicalLabsAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Pre-launch bypass: when billing isn't enforced, everyone gets full access
  if (!BILLING_ENFORCED) return next();

  const { accessTier, planLookupKey } = authReq.authUser;

  // Must have an active paid subscription
  if (accessTier !== "PAID_FULL") {
    res.status(403).json({
      error: "Lab value tracking requires a Clinical subscription",
      code: "CLINICAL_LABS_REQUIRED",
      requiredTier: "clinical",
      accessTier,
    });
    return;
  }

  // No planLookupKey with PAID_FULL = sandbox/internal account — grant access
  if (!planLookupKey) return next();

  // Check actual plan tier from the lookup key
  const tier = getTierForLookupKey(planLookupKey);
  if (tier === "ultimate") return next();

  res.status(403).json({
    error: "Lab value tracking requires a Clinical subscription",
    code: "CLINICAL_LABS_REQUIRED",
    requiredTier: "clinical",
    accessTier,
    currentTier: tier,
  });
}
