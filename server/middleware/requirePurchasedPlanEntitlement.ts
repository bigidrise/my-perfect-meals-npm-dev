import type { Request, Response, NextFunction } from "express";
import {
  type Entitlement,
  getMinTierForEntitlement,
  getTierForLookupKey,
  tierIncludesEntitlement,
} from "@shared/planFeatures";
import type { AuthenticatedRequest } from "./requireAuth";

const TIER_LABELS = {
  free: "Free",
  basic: "Essential",
  premium: "Pro",
  ultimate: "Clinical",
} as const;

/**
 * Enforces the entitlement attached to the customer's purchased plan.
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