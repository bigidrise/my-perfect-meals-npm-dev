import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { getTierForLookupKey } from "@shared/planFeatures";

/**
 * requireMonetizationAccess — gates routes that require Pro or higher for earning / affiliate access.
 *
 * Rule: "Academy certification proves knowledge. Subscription level determines what
 *       the account is allowed to do." Completing Platform Mastery + Marketing & Coaching
 *       does NOT unlock affiliate earnings — subscription does.
 *
 * Passing: Pro (premium) or Clinical/ProCare (ultimate) plans, internal accounts.
 * Blocked: Free, Basic (Essentials), trial-only entitlement.
 */

const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

export function requireMonetizationAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (!BILLING_ENFORCED) return next();

  const { accessTier, planLookupKey } = authReq.authUser;

  if (accessTier !== "PAID_FULL") {
    res.status(403).json({
      error: "Affiliate and monetization features require a Pro subscription or higher.",
      code: "MONETIZATION_REQUIRED",
      requiredTier: "pro",
    });
    return;
  }

  // Internal account — grant access
  if (!planLookupKey) return next();

  const tier = getTierForLookupKey(planLookupKey);
  if (tier === "premium" || tier === "ultimate") return next();

  res.status(403).json({
    error: "Affiliate and monetization features require a Pro subscription or higher.",
    code: "MONETIZATION_REQUIRED",
    requiredTier: "pro",
    currentTier: tier,
  });
}
