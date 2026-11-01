import type { Request, Response, NextFunction } from "express";
import {
  type Entitlement,
  getMinTierForEntitlement,
  getTierForLookupKey,
  tierIncludesEntitlement,
} from "@shared/planFeatures";
import type { AuthenticatedRequest } from "./requireAuth";
import { hasPersonalClinicalReconciliationAccess } from "../lib/personalClinicalReconciliationAccess";

const TIER_LABELS = {
  free: "Free",
  basic: "Essential",
  premium: "Pro",
  ultimate: "Clinical",
} as const;

/**
 * Enforces purchased entitlements, plus the explicitly reconciled personal
 * Hydration grant. No other trial/internal entitlement bypass is introduced.
 *
 * This intentionally does not honor tester, founder, sandbox, trial, or the
 * global BILLING_ENFORCED=false bypass. It is for product boundaries that must
 * remain testable as Free/Essential while broader pre-launch access is enabled.
 */
export function requirePurchasedPlanEntitlement(feature: Entitlement) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    if (feature === "hydration_center" && hasPersonalClinicalReconciliationAccess(authUser)) {
      next();
      return;
    }

    const currentTier = getTierForLookupKey(authUser.planLookupKey);
    if (
      authUser.planLookupKey &&
      tierIncludesEntitlement(currentTier, feature)
    ) {
      next();
      return;
    }

    const requiredTier = getMinTierForEntitlement(feature);
    res.status(403).json({
      error: `This feature requires a ${TIER_LABELS[requiredTier]} subscription or higher`,
      code: requiredTier === "premium" ? "PRO_REQUIRED" : "PLAN_REQUIRED",
      feature,
      requiredTier,
      currentTier,
    });
  };
}