import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { canAccessProCareStudio } from "@shared/planFeatures";

/**
 * requireProCareAccess — gates routes that require an active ProCare subscription.
 *
 * THREE THINGS ARE INTENTIONALLY KEPT SEPARATE:
 *   1. Academy certification  — proves knowledge (requirePhase1Cert / requirePhase2Training)
 *   2. Monetization eligibility — Pro subscription or higher  (requireMonetizationAccess)
 *   3. ProCare workspace access — actual paid ProCare plan   (THIS middleware)
 *
 * Passing: active ProCare plan (mpm_procare_*, mpm_trainer_*, mpm_physician_*) or
 *          internal/founder account (null planLookupKey + PAID_FULL).
 * Blocked: Free, Basic, Pro (premium), Clinical (ultimate) without a ProCare plan,
 *          trial-only access, and ANY account that merely completed ProCare Certification.
 *
 * Cert completion is NOT checked here and must NEVER be used as a proxy for subscription.
 */

const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

export function requireProCareAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const {
    accessTier,
    planLookupKey,
    sponsoredByBusinessId,
    sponsoredProCareAccess,
    pilotProCareAccess,
    isFounder,
  } = authReq.authUser;

  if (canAccessProCareStudio({
    billingEnforced: BILLING_ENFORCED,
    accessTier,
    planLookupKey,
    sponsoredByBusinessId,
    sponsoredProCareAccess,
    pilotProCareAccess,
    isInternalAccount: isFounder,
  })) {
    next();
    return;
  }

  if (accessTier !== "PAID_FULL") {
    res.status(403).json({
      error: "ProCare Studio requires an active ProCare subscription.",
      code: "PROCARE_SUBSCRIPTION_REQUIRED",
      requiredTier: "procare",
    });
    return;
  }

  res.status(403).json({
    error: "ProCare Studio requires an active ProCare subscription. Your current plan does not include ProCare access.",
    code: "PROCARE_SUBSCRIPTION_REQUIRED",
    requiredTier: "procare",
    currentPlan: planLookupKey,
  });
}
