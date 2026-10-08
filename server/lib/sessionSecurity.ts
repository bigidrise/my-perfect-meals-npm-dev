import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "connect.sid";

export function sessionCookieSecurity(
  nodeEnv = process.env.NODE_ENV,
  embeddedDevelopment = Boolean(process.env.REPLIT_DEV_DOMAIN),
) {
  const isProduction = nodeEnv === "production";
  const iframePreview = !isProduction && embeddedDevelopment;
  return {
    httpOnly: true,
    secure: isProduction || iframePreview,
    sameSite: isProduction || iframePreview ? "none" as const : "lax" as const,
    // The preview is embedded on another site. CHIPS keeps its cookie scoped
    // to that embedding site even when ordinary third-party cookies are blocked.
    ...(iframePreview ? { partitioned: true } : {}),
  };
}

export function regenerateSession(req: Request): Promise<void> {
  if (!req.session || typeof req.session.regenerate !== "function") {
    return Promise.reject(new Error("Session middleware is unavailable"));
  }

  return new Promise((resolve, reject) => {
    req.session.regenerate((error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function destroySession(req: Request): Promise<void> {
  if (!req.session || typeof req.session.destroy !== "function") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    req.session.destroy((error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: "/",
    ...sessionCookieSecurity(),
  });
}

export function isMfaVerifiedForUser(
  req: Request,
  userId: string,
): boolean {
  return (
    req.session?.mfaVerified === true &&
    (req.session as typeof req.session & { userId?: string }).userId === userId
  );
}