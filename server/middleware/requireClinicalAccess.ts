import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { getTierForLookupKey } from "@shared/planFeatures";

/**
 * requireClinicalAccess — blocks Essential and Pro users from Clinical-tier features.
 * Passes: Clinical (ultimate) plan, trials, sandbox/internal accounts.
 * Blocks: FREE, Essential (basic), Pro (premium) plans.
 *
 * When BILLING_ENFORCED=false (pre-launch), all users pass — same as the rest of the
 * access tier system.
 *
 * Clinical-tier features: Performance Nutrition Builder, My Perfect Pregnancy,
 *   Getaway, Therapeutic Nutrition Intelligence, Lab Metrics, Care Team.
 *
 * For features that must also block trial users, use requireStrictClinicalAccess below.
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

  // Pre-launch bypass: when billing isn't enforced, everyone gets full access
  if (!BILLING_ENFORCED) return next();

  const { accessTier, planLookupKey, isSandbox } = authReq.authUser;

  // Sandbox/internal accounts always pass all tiers
  if (isSandbox) return next();

  // Must have at minimum a paid or trial subscription
  if (accessTier !== "PAID_FULL" && accessTier !== "TRIAL_FULL") {
    res.status(403).json({
      error: "This feature requires a Clinical subscription",
      code: "CLINICAL_REQUIRED",
      requiredTier: "clinical",
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
 * requireStrictClinicalAccess — same as requireClinicalAccess but explicitly
 * blocks TRIAL_FULL users.  Use for Clinical features that are NOT part of
 * the trial experience: Therapeutic Nutrition Intelligence, Lab Values, etc.
 *
 * Passes:  Clinical (ultimate) paid plan, sandbox/internal accounts.
 * Blocks:  FREE, TRIAL_FULL, Essential (basic), Pro (premium).
 */
export function requireStrictClinicalAccess(
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

  // Trial users are explicitly blocked — not a trial entitlement
  if (accessTier === "TRIAL_FULL") {
    res.status(403).json({
      error: "This feature requires a Clinical subscription",
      code: "CLINICAL_REQUIRED",
      requiredTier: "clinical",
      accessTier,
      trialExclusion: true,
    });
    return;
  }

  if (accessTier !== "PAID_FULL") {
    res.status(403).json({
      error: "This feature requires a Clinical subscription",
      code: "CLINICAL_REQUIRED",
      requiredTier: "clinical",
      accessTier,
    });
    return;
  }

  // No planLookupKey with PAID_FULL = internal/sandbox account — grant access
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
