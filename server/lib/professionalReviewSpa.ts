import type { RequestHandler } from "express";

// Only serve the existing SPA document; no private data or mutation lives here.
// QA's feature flag must not shadow the unrelated professional-review screen
// or the approved Development-only founder pilot document.
export function professionalReviewSpa(
  qa: RequestHandler,
  env: Pick<NodeJS.ProcessEnv, "NODE_ENV" | "REPLIT_DEPLOYMENT"> = process.env,
): RequestHandler {
  const developmentPilotDocument = env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT;
  return (req, res, next) => {
    if ((req.method === "GET" || req.method === "HEAD") &&
      (req.path === "/professional-requests" || req.path === "/professional-requests/")) return next();
    // This serves only the generic SPA shell, never pilot data or mutations.
    // The page's admin gate and every API's authentication/MFA gate still apply.
    if (developmentPilotDocument && (req.method === "GET" || req.method === "HEAD") &&
      req.path === "/pilots") return next();
    return qa(req, res, next);
  };
}
