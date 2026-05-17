import type { Request, Response, NextFunction } from "express";
import type { OrgFeatureFlags } from "../lib/orgContext";
import { reqOrgHasFlag } from "../utils/getOrgContext";

/**
 * Middleware factory that gates a route behind an org-level feature flag.
 * If the authenticated user's org does not have the flag enabled, returns 403.
 *
 * Usage:
 *   router.get("/some-route", requireAuth, requireOrgFlag("glp1Support"), handler);
 *
 * Default org flags (see server/db/schema/organizations.ts DEFAULT_ORG_FEATURE_FLAGS):
 *   glp1Support: true   — safe to gate; white-label orgs can opt out
 *   diabeticHub: true   — safe to gate
 *   coachTools: true    — safe to gate
 *   biometricTracking: true — safe to gate
 *
 * NOT YET SAFE to gate (default false, MPM org needs DB record update first):
 *   physicianDashboard: false
 *   oncologySupport: false  (currently controlled by ONCOLOGY_SUPPORT_V1 env var instead)
 */
export function requireOrgFlag(flag: keyof OrgFeatureFlags) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!reqOrgHasFlag(req, flag)) {
      return res.status(403).json({
        ok: false,
        error: "OrgFeatureDisabled",
        flag,
        message: `This feature (${flag}) is not enabled for your organization.`,
      });
    }
    next();
  };
}
