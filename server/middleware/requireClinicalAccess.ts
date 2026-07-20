import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { getTierForLookupKey } from "@shared/planFeatures";

/**
 * requireClinicalAccess — blocks Essential and Pro users from Clinical-tier features.
 * Passes: Clinical (ultimate) plan, sandbox/internal accounts.
 * Blocks: FREE, Essential (basic), Pro (premium) plans.
 *
 * When BILLING_ENFORCED=false (pre-launch), all users pass.
 *
 * Clinical-tier features: Performance Nutrition Builder, My Perfect Pregnancy,
 *   Getaway, Therapeutic Nutrition Intelligence, Lab Metrics, Care Team.
 */

const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

export function requireClinicalAccess(
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

  const { accessTier, planLookupKey, isSandbox } = authReq.authUser;

  if (isSandbox) return next();

  if (accessTier !== "PAID_FULL") {
    res.status(403).json({
      error: "This feature requires a Clinical subscription",
      code: "CLINICAL_REQUIRED",
      requiredTier: "clinical",
      accessTier,
    });
    return;
  }

  // No planLookupKey with PAID_FULL = internal account (founder, etc.) — grant access
  if (!planLookupKey) return next();

  const tier = getTierForLookupKey(planLookupKey);
  if (tier === "ultimate") return next();

  res.status(403).json({
    error: "This feature requires a Clinical subscription",
    code: "CLINICAL_REQUIRED",
    requiredTier: "clinical",
    accessTier,
    currentTier: tier,
  });
}

/**
 * requireStrictClinicalAccess — Clinical plan only; identical to requireClinicalAccess
 * now that the trial system is removed. Kept as a separate export for call-site clarity.
 */
export function requireStrictClinicalAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  return requireClinicalAccess(req, res, next);
}
