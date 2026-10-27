import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireMfa } from "../middleware/requireMfa";
import { businessPilotActivationEnabled, BusinessPilotActivationError, unifiedBusinessPilotDevelopmentEnabled } from "../services/businessPilotActivationPolicy";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { ensureCanonicalWorkspaceForBusiness } from "../services/organizationWorkspaceService";
import {
  issueBusinessPilotLink, inspectBusinessPilotLink,
  activateBusinessPilotLink, getBusinessPilotActivation,
} from "../services/businessPilotActivationService";

const router = Router();
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!businessPilotActivationEnabled()) return res.status(503).json({
    code: "PILOT_NOT_RELEASED", error: "Business Pilot activation awaits schema and release approval.",
  });
  next();
});
const handle = (fn: any) => async (req: any, res: any) => {
  try { await fn(req, res); } catch (error) {
    if (error instanceof BusinessPilotActivationError || (error as any)?.statusCode) {
      return res.status((error as any).statusCode).json({ error: (error as Error).message, code: (error as any).code });
    }
    // Never log a request URL, token, email, or SQL parameters.
    console.error("[business-pilot-activation] operation failed");
    res.status(503).json({ error: "Pilot activation could not be verified. No new access was granted." });
  }
};
router.post("/issue", requireAuth, requireMfa, handle(async (req: any, res: any) => {
  if (!req.authUser.isFounder) return res.status(403).json({ error: "Founder authorization required." });
  res.status(201).json(await issueBusinessPilotLink(req.body?.email, req.authUser.id));
}));
router.get("/inspect", requireAuth, handle(async (req: any, res: any) => {
  res.setHeader("Cache-Control", "no-store");
  const invitation = await inspectBusinessPilotLink(req.get("x-business-pilot-token"));
  if (!unifiedBusinessPilotDevelopmentEnabled()) return res.json(invitation);
  const result = await db.execute(sql`SELECT id, name FROM businesses
    WHERE owner_user_id = ${req.authUser.id} ORDER BY name, id`);
  res.json({ ...invitation, unified: true, organizations: result.rows ?? result });
}));
router.post("/claim", requireAuth, requireMfa, handle(async (req: any, res: any) => {
  const grant = await activateBusinessPilotLink(req.body?.token, req.authUser.id, {
    businessId: typeof req.body?.businessId === "string" ? req.body.businessId : undefined,
    organizationName: typeof req.body?.organizationName === "string" ? req.body.organizationName : undefined,
  });
  // The claim transaction durably binds one business before this resumable step.
  // If tenant creation fails, the unchanged invitation retries the same business.
  const workspace = unifiedBusinessPilotDevelopmentEnabled() && "businessId" in grant && grant.businessId
    && grant.endsAt.getTime() > Date.now()
    ? await ensureCanonicalWorkspaceForBusiness(grant.businessId) : null;
  res.json({ ...grant, ...(workspace ?? {}) });
}));
router.get("/status", requireAuth, handle(async (req: any, res: any) => {
  const grant = await getBusinessPilotActivation(req.authUser.id);
  res.setHeader("Cache-Control", "no-store");
  res.json(grant ? {
    startedAt: grant.personal_access_started_at, endsAt: grant.personal_access_ends_at,
    businessId: grant.business_id, status: grant.status,
    organizationConsumed: grant.organization_consumed,
  } : null);
}));
export default router;
