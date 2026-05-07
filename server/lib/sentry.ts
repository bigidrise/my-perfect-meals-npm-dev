import * as Sentry from "@sentry/node";
import type { Express, Request, Response, NextFunction } from "express";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("[Sentry] SENTRY_DSN not set — error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0.0,
    sendDefaultPii: false,
    ignoreErrors: [
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
    ],
  });

  initialized = true;
  console.log(`[Sentry] ✅ Initialized — env: ${process.env.NODE_ENV || "development"}`);
}

export function sentryRequestHandler() {
  if (!initialized) return (_req: Request, _res: Response, next: NextFunction) => next();
  return Sentry.expressErrorHandler();
}

export function sentryErrorHandler() {
  if (!initialized) return (_err: any, _req: Request, _res: Response, next: NextFunction) => next(_err);
  return Sentry.expressErrorHandler();
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, val]) => scope.setExtra(key, val));
    }
    Sentry.captureException(err);
  });
}

export function setUserContext(userId: string, email: string): void {
  if (!initialized) return;
  Sentry.setUser({ id: userId, email });
}

export function clearUserContext(): void {
  if (!initialized) return;
  Sentry.setUser(null);
}

export { Sentry };
