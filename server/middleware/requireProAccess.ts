import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { getTierForLookupKey } from "@shared/planFeatures";

/**
 * requireProAccess — blocks Essential and FREE users from Pro-tier features.
 * Passes: Pro (premium) or Clinical (ultimate) plan, trials, sandbox/internal accounts.
 * Blocks: FREE, Essential (basic) plan.
 *
 * When BILLING_ENFORCED=false (pre-launch), all users pass — same as the rest of the
 * access tier system.
 *
 * Pro-tier features: Craving Creator, Dessert/Beverage/Sushi Creators,
 *   Restaurant Guide, Fast Food Guide, Gatherings, My Perfect Pets,
 *   Chef Pairings, Grocery Coach, Creator Studio.
 */

const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

export function requireProAccess(
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

  const { accessTier, planLookupKey, isSandbox } = authReq.authUser;

  // Sandbox/internal accounts always pass all tiers
  if (isSandbox) return next();

  // Must have at minimum a paid or trial subscription
  if (accessTier !== "PAID_FULL" && accessTier !== "TRIAL_FULL") {
    res.status(403).json({
      error: "This feature requires a Pro subscription or higher",
      code: "PRO_REQUIRED",
      requiredTier: "pro",
      accessTier,
    });
    return;
  }

  // Trial users unlock all tiers (TRIAL_UNLOCKS_TIER = "ultimate")
  if (accessTier === "TRIAL_FULL") return next();

  // No planLookupKey with PAID_FULL = internal account (founder, etc.) — grant access
  if (!planLookupKey) return next();

  // Check actual plan tier from the lookup key
  const tier = getTierForLookupKey(planLookupKey);
  if (tier === "premium" || tier === "ultimate") return next();

  res.status(403).json({
    error: "This feature requires a Pro subscription or higher",
    code: "PRO_REQUIRED",
    requiredTier: "pro",
    accessTier,
    currentTier: tier,
  });
}
