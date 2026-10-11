import type { Request, Response, NextFunction } from "express";
import {
  developmentStripeIsolated, DevelopmentStripeIsolationError,
} from "../services/developmentStripeIsolation";

export function isBillingRequest(path: string): boolean {
  // Match resource segments, not user-supplied query parameters or substrings.
  return /^\/api\/(?:stripe|promotions)(?:\/|$)/i.test(path)
    || /^\/api\//i.test(path) && /\/(?:billing|checkout|subscriptions?|payments?|renewal|reconcile-checkout|coupons)(?:\/|$)/i.test(path);
}

export function developmentStripeIsolationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!developmentStripeIsolated() || !isBillingRequest(req.path)) return next();
  const error = new DevelopmentStripeIsolationError();
  res.setHeader("Cache-Control", "no-store");
  return res.status(error.statusCode).json({ code: error.code, error: error.message });
}
