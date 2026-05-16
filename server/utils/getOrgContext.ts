import type { Request } from "express";
import type { OrgContext, OrgFeatureFlags } from "../lib/orgContext";
import { getDefaultOrgContext, orgHasFlag } from "../lib/orgContext";

export function getOrgContext(req: Request): OrgContext {
  return (req as any).orgContext ?? getDefaultOrgContext();
}

export function reqOrgHasFlag(req: Request, flag: keyof OrgFeatureFlags): boolean {
  return orgHasFlag(getOrgContext(req), flag);
}
