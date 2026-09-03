import type { Request, Response, NextFunction } from "express";
import { FEATURE_KEYS, FeatureMinPlan, planMeets, type Plan } from "../config/entitlements";
import type { AuthenticatedRequest } from "./requireAuth";

export function requireFeature(featureKey: keyof typeof FEATURE_KEYS) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.UNLOCK_ALL_FEATURES === "true") return next();

    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    if (authUser.isTester) return next();

    const userPlan = (authUser.plan as Plan) ?? "BASIC";
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
