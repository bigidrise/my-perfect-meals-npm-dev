import type { Request, Response, NextFunction } from "express";
import { FEATURE_KEYS, FeatureMinPlan, planMeets } from "../config/entitlements";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; plan: "BASIC" | "UPGRADE" | "ULTIMATE" | "TESTER_ALPHA" | "TESTER_BETA" };
  }
}

export function requireFeature(featureKey: keyof typeof FEATURE_KEYS) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Global toggle to unlock during development/testing
    if (process.env.UNLOCK_ALL_FEATURES === "true") return next();

    // For alpha testing, set all users as TESTER_ALPHA to bypass restrictions
    const userPlan = req.user?.plan ?? "TESTER_ALPHA"; // Default to alpha tester during testing phase
    const minPlan = FeatureMinPlan[FEATURE_KEYS[featureKey]];
    
    if (!planMeets(minPlan, userPlan)) {
      return res.status(402).json({
        ok: false,
        error: "FeatureLocked",
        feature: featureKey,
        requiredPlan: minPlan,
        message: `This feature requires the ${minPlan} plan.`,
      });
    }
    next();
  };
}