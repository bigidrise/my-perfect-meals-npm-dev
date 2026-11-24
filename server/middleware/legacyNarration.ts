import type { RequestHandler } from "express";
import { LEGACY_CHEF_NARRATION_ENABLED } from "../../shared/legacyNarration";

/** Stops stale clients before provider credentials or paid services are used. */
export const requireLegacyNarration: RequestHandler = (_req, res, next) => {
  if (!LEGACY_CHEF_NARRATION_ENABLED) {
    res.status(410).json({ code: "LEGACY_NARRATION_DISABLED", error: "Legacy narration is disabled." });
    return;
  }
  next();
};
