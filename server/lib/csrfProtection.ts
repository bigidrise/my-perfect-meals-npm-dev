import crypto from "crypto";
import type { Express, NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_HEADER = "x-csrf-token";
const PREAUTHENTICATION_PATHS = new Set([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "");
}

function configuredOrigins(): Set<string> {
  const developmentOrigins =
    process.env.NODE_ENV === "production"
      ? []
      : [
          "http://localhost:5173",
          "http://localhost:5000",
          "http://127.0.0.1:5000",
          "https://localhost",
          "http://localhost",
        ];
  const configured = [
    ...(process.env.CORS_ORIGIN?.split(",") ?? []),
    process.env.APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : undefined,
    ...developmentOrigins,
    "https://myperfectmeals.com",
    "https://www.myperfectmeals.com",
    "https://app.myperfectmeals.com",
    "https://myperfectmeals.ai",
    "https://www.myperfectmeals.ai",
    "https://app.myperfectmeals.ai",
    "https://my-perfect-meals-frontend-clean.vercel.app",
    "capacitor://localhost",
    "ionic://localhost",
  ];
  return new Set(
    configured
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => normalizeOrigin(value.trim())),
  );
}

export function isTrustedRequestOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;

  const normalized = normalizeOrigin(origin);
  const host = req.get("host");
  if (host) {
    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || req.protocol;
    if (normalized === `${protocol}://${host}`) return true;
  }

  return configuredOrigins().has(normalized);
}

function timingSafeTokenMatch(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const hasBearer = Boolean(req.get("x-auth-token"));
  const hasApiClientMarker =
    req.get("x-requested-with") === "XMLHttpRequest";
  const isAuthenticatedCallback =
    req.path === "/api/webhooks/rewardful";
  const hasOrigin = Boolean(req.get("origin"));

  if (
    (!hasOrigin &&
      !hasBearer &&
      !hasApiClientMarker &&
      !isAuthenticatedCallback) ||
    (hasOrigin && !isTrustedRequestOrigin(req))
  ) {
    res.status(403).json({
      error: "Request origin is not allowed",
      code: "CSRF_ORIGIN_REJECTED",
    });
    return;
  }

  // Explicit bearer credentials and native clients do not rely on ambient
  // browser cookies, so they are not vulnerable to browser CSRF.
  if (hasBearer) {
    next();
    return;
  }

  // Pre-authentication routes must remain usable when a browser carries a stale
  // authenticated session cookie. Exact-origin validation above still blocks
  // login CSRF; these routes do not mutate the existing authenticated account.
  if (PREAUTHENTICATION_PATHS.has(req.path) || !req.session?.userId) {
    next();
    return;
  }

  const expected = req.session.csrfToken;
  const supplied = req.get(CSRF_HEADER);
  if (
    typeof expected !== "string" ||
    typeof supplied !== "string" ||
    !timingSafeTokenMatch(expected, supplied)
  ) {
    res.status(403).json({
      error: "CSRF validation failed",
      code: "CSRF_TOKEN_INVALID",
    });
    return;
  }

  next();
}

export function registerCsrfProtection(app: Express): void {
  app.get("/api/auth/csrf", (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString("base64url");
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ csrfToken: req.session.csrfToken });
  });
  app.use(csrfProtection);
}