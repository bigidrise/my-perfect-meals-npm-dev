import { Request, Response, NextFunction } from "express";

/**
 * Returns true if the Resend email service is configured.
 * Use this for programmatic checks inside route handlers.
 */
export function emailServiceAvailable(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Express middleware that returns a 503 response when the Resend email
 * service is not configured. Apply to any route where email delivery is
 * the primary purpose of the action (e.g. invites, notifications).
 *
 * Usage as route middleware:
 *   router.post("/invite", requireAuth, requireEmailService, handler);
 *
 * Usage as an inline guard (when email is the primary action but the
 * middleware pattern doesn't fit):
 *   if (!emailServiceAvailable()) {
 *     return res.status(503).json({ ok: false, error: EMAIL_SERVICE_UNAVAILABLE });
 *   }
 */
export const EMAIL_SERVICE_UNAVAILABLE =
  "Email service is not configured (RESEND_API_KEY missing). This action requires email delivery.";

export function requireEmailService(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!process.env.RESEND_API_KEY) {
    res.status(503).json({ ok: false, error: EMAIL_SERVICE_UNAVAILABLE });
    return;
  }
  next();
}
