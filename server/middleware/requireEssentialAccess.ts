import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";

/**
 * requireEssentialAccess — blocks FREE-tier users from Essential+ features.
 * Passes: PAID_FULL (any active paid plan, including Basic/Essential and above).
 * Blocks: FREE tier and TRIAL_FULL (trial system removed — no trials in product).
 *
 * This is the correct middleware for Essential-tier features:
 *   Shopping List, Saved Meals, Create a Dish, Weekly Meal Planner, etc.
 */
export function requireEssentialAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { accessTier } = authReq.authUser;

  if (accessTier === "PAID_FULL") {
    return next();
  }

  res.status(403).json({
    error: "This feature requires an Essential subscription or higher",
    code: "ESSENTIAL_REQUIRED",
    requiredTier: "essential",
    accessTier,
  });
}
