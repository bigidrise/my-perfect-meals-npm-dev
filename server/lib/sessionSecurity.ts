import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "connect.sid";

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
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
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