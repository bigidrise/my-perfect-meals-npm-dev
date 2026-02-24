import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";

export function requirePremiumAccess(
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

  if (accessTier === "PAID_FULL" || accessTier === "TRIAL_FULL") {
    return next();
  }

  res.status(403).json({
    error: "This feature requires an active subscription",
    code: "PREMIUM_REQUIRED",
    accessTier,
  });
}
