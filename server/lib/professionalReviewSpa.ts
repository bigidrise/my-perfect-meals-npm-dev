import type { RequestHandler } from "express";

// Only serve the existing SPA document; no private data or mutation lives here.
// QA's feature flag must not shadow the unrelated professional-review screen.
export function professionalReviewSpa(qa: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if ((req.method === "GET" || req.method === "HEAD") &&
      (req.path === "/professional-requests" || req.path === "/professional-requests/")) return next();
    return qa(req, res, next);
  };
}
