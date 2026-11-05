import type { RequestHandler } from "express";

/**
 * Reuse Ask Chef's existing availability setting; this is not a behavior gate.
 * Configure the same value at client build time and server runtime.
 * No override preserves existing API access; explicit false hides the API too.
 */
export const requireAskChefAvailability: RequestHandler = (_req, res, next) => {
  if (process.env.VITE_COACHES_CORNER_ENABLED === "false") {
    res.status(404).json({ error: "Ask Chef is not available.", code: "CHEF_UNAVAILABLE" });
    return;
  }
  next();
};
