import type { Request, Response, NextFunction } from "express";
import type { DemoGrant } from "@shared/demoProfessional";

export interface DemoBoundaryActor {
  id: string; username: string; email: string; role: string; professionalRole: string | null;
  isProCare: boolean | null; planLookupKey: string | null;
}
export interface DemoBoundaryDependencies {
  actor(req: Request): Promise<DemoBoundaryActor | null>;
  restriction(userId: string): Promise<DemoGrant | null>;
}
function normalizedPath(req: Request) {
  return decodeURIComponent((req.originalUrl || req.url).split("?")[0]).replace(/\/+/g, "/").toLowerCase();
}
function demoEndpoint(method: string, path: string) {
  if (method === "GET" && path === "/api/demo-professional/context") return true;
  if (method === "POST" && path === "/api/demo-professional/acknowledgment") return true;
  const patient = "/api/demo-professional/workspaces/[a-f0-9-]{36}/patients";
  if (["GET", "POST"].includes(method) &&
      new RegExp(`^${patient}/[a-f0-9-]{36}/invitation${method === "POST" ? "(?:/accept)?" : ""}$`).test(path)) return true;
  if (method === "GET" && new RegExp(`^${patient}(?:/[a-f0-9-]{36}(?:/(?:messages|media|export)|/media/[a-f0-9-]{36})?)?$`).test(path)) return true;
  return method === "PUT" && new RegExp(`^${patient}/[a-f0-9-]{36}/plan$`).test(path);
}
const authenticationPaths = new Set([
  "POST /api/auth/login", "POST /api/auth/logout", "POST /api/auth/mfa/challenge",
  "POST /api/auth/mfa/challenge/backup", "GET /api/auth/mfa/status", "GET /api/auth/session",
  "GET /api/auth/csrf",
]);
export function createDemoDataBoundary(deps: DemoBoundaryDependencies) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let path: string;
    try { path = normalizedPath(req); } catch { return res.status(400).json({ code: "INVALID_REQUEST_PATH" }); }
    // App assets/pages carry no clinical records. Existing object-serving paths
    // are data, not assets; block all of them for a restricted actor.
    const dataPath = /^\/api(?:\/|$)|^\/(?:objects|public-objects|uploads|files|media)(?:\/|$)/.test(path);
    if (!dataPath || path === "/api/stripe/webhook") return next();
    res.set("Cache-Control", "no-store");
    // Authentication remains possible after session/version revocation.
    // These handlers expose only authenticated own-session/MFA state.
    if (authenticationPaths.has(`${req.method} ${path}`)) return next();
    try {
      const actor = await deps.actor(req);
      if (!actor) return next(); // Existing anonymous/signed-callback authorization is unchanged.
      const grant = await deps.restriction(actor.id);
      if (!grant) return next();
      // Prepared/revoked/expired grants stay restrictive. No fallback to live.
      if (path === "/api/user/profile" && req.method === "GET") {
        return res.json({ id: actor.id, username: actor.username, email: actor.email, role: actor.role,
          professionalRole: actor.professionalRole, isProCare: actor.isProCare, planLookupKey: actor.planLookupKey,
          operatingStatus: "demo_only", demoGrantState: grant.state,
          // Intentionally no real profile/health/credential/Studio payload.
          preferredLanguage: "auto",
        });
      }
      if (demoEndpoint(req.method, path)) return next();
      return res.status(403).json({ code: "DEMO_LIVE_DATA_DENIED", error: "This account is demo-only. Existing/live data APIs, search, relationships, messages, files and exports are unavailable. Use the isolated synthetic workspace." });
    } catch (error) {
      if ((error as { code?: string })?.code === "AUTH_REAUTHENTICATION_REQUIRED") {
        return res.status(401).json({ code: "AUTH_REAUTHENTICATION_REQUIRED", error: "Sign in again." });
      }
      return res.status(503).json({ code: "DEMO_BOUNDARY_UNAVAILABLE", error: "Data scope could not be verified. Access is blocked; retry later." });
    }
  };
}
