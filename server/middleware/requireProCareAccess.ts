import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { canAccessProCareStudio, isProCarePlanKey } from "@shared/planFeatures";
import { readIndependentStudioAccess } from "../services/independentStudioAccess";

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
): Promise<void> | void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  return readIndependentStudioAccess(authReq.authUser.id).then((independent) => {
    if (independent.hasSubscription) {
      if (independent.studioActive &&
          (independent.billing?.state === "active" || independent.billing?.state === "ending")) {
        next();
        return;
      }
      // A Personal professional plan must not revive an expired independent Studio.
      // Internal/managed sources retain their own existing authorization policy.
      if (!authReq.authUser.isFounder && !authReq.authUser.isSandbox &&
          !authReq.authUser.isTester && !authReq.authUser.sponsoredProCareAccess &&
          !authReq.authUser.pilotProCareAccess) {
        denyProCareAccess(res, authReq.authUser.accessTier, authReq.authUser.planLookupKey);
        return;
      }
    }
    if (!independent.hasSubscription && !independent.legacyEligible &&
        isProCarePlanKey(authReq.authUser.planLookupKey) &&
        !authReq.authUser.isFounder && !authReq.authUser.isSandbox &&
        !authReq.authUser.isTester && !authReq.authUser.sponsoredProCareAccess &&
        !authReq.authUser.pilotProCareAccess) {
      denyProCareAccess(res, authReq.authUser.accessTier, authReq.authUser.planLookupKey);
      return;
    }
    if (!independent.hasSubscription &&
        authReq.authUser.planLookupKey === "clinical_business_monthly" &&
        !authReq.authUser.isFounder && !authReq.authUser.isSandbox &&
        !authReq.authUser.isTester && !authReq.authUser.sponsoredProCareAccess &&
        !authReq.authUser.pilotProCareAccess) {
      denyProCareAccess(res, authReq.authUser.accessTier, authReq.authUser.planLookupKey);
      return;
    }
    checkLegacyProCareAccess(authReq, res, next);
  }).catch((error) => {
    console.error("[studio-access] verified Studio access unavailable", error);
    res.status(503).json({ error: "Unable to verify Studio access right now." });
  });
}

function checkLegacyProCareAccess(
  authReq: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const {
    accessTier,
    planLookupKey,
    sponsoredByBusinessId,
    sponsoredProCareAccess,
    pilotProCareAccess,
    isFounder,
    isSandbox,
    isTester,
    pilotFullAccess,
  } = authReq.authUser;

  if (
    pilotFullAccess &&
    !sponsoredProCareAccess &&
    !pilotProCareAccess &&
    !planLookupKey &&
    !isFounder &&
    !isSandbox &&
    !isTester
  ) {
    res.status(403).json({
      error: "Pilot access does not grant ProCare Studio authority.",
      code: "PROCARE_SUBSCRIPTION_REQUIRED",
      requiredTier: "procare",
    });
    return;
  }

  if (canAccessProCareStudio({
    billingEnforced: BILLING_ENFORCED,
    accessTier,
    planLookupKey,
    sponsoredByBusinessId,
    sponsoredProCareAccess,
    pilotProCareAccess,
    isInternalAccount: isFounder || isSandbox || isTester,
  })) {
    next();
    return;
  }

  denyProCareAccess(res, accessTier, planLookupKey);
}

function denyProCareAccess(res: Response, accessTier: string, planLookupKey: string | null): void {
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
