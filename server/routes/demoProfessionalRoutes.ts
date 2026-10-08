import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { demoGrantActivationInput, demoGrantPreparationInput, demoGrantRevocationInput, demoPlanInput, DEMO_ACKNOWLEDGMENT_VERSION } from "@shared/demoProfessional";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireProfessionalIdentityReviewer } from "../middleware/requireProfessionalIdentityReviewer";
import type { IdentityReviewerProof } from "../services/professionalIdentityDecisionService";
import { createDemoProfessionalService } from "../services/demoProfessionalService";
import { demoProfessionalRepository, demoRepositoryForActor, readDemoRestriction, readDemoGrantHistory } from "../services/demoProfessionalRepository";
import { ProfessionalRequestError } from "../services/professionalOnboardingService";
import { CareInvitationError } from "../services/careInvitationPolicy";

export const demoProfessionalRouter = Router();
export const demoProfessionalAdminRouter = Router();
const service = createDemoProfessionalService(demoProfessionalRepository);
const requestServices = new WeakMap<Request, ReturnType<typeof createDemoProfessionalService>>();
function actorService(req: Request) {
  const selected = requestServices.get(req);
  if (!selected) throw new Error("Demo repository was not resolved");
  return selected;
}
function noAuthoritySelectors(req: Request, res: Response, next: () => void) {
  res.set("Cache-Control", "no-store");
  if (Object.keys(req.query).length) return res.status(400).json({ code: "DEMO_INVALID_QUERY", error: "Demo flags and subject selectors are not accepted." });
  next();
}
function failure(res: Response, error: unknown) {
  if (error instanceof CareInvitationError) return res.status(error.status).json({ code: error.code, error: error.message });
  if (error instanceof ProfessionalRequestError) return res.status(error.status).json({ code: error.code, error: error.message });
  return res.status(503).json({ code: "DEMO_STORAGE_UNAVAILABLE", error: "Demo storage is unavailable. No successful change is confirmed; reload before retrying." });
}
function user(req: Request) { return (req as AuthenticatedRequest).authUser.id; }
function ids(req: Request) {
  for (const key of ["workspaceId","patientId","mediaId"]) if (req.params[key] && !z.string().uuid().safeParse(req.params[key]).success) throw new ProfessionalRequestError(400, "DEMO_INVALID_ID", "A valid synthetic record ID is required.");
}
// Same synthetic-only authority checks in both runtimes. No role, subscription,
// founder flag or request flag grants access without an explicit current grant.
demoProfessionalRouter.use(noAuthoritySelectors, requireAuth, async (req, res, next) => {
  try {
    requestServices.set(req, createDemoProfessionalService(await demoRepositoryForActor(user(req))));
    next();
  } catch (error) { failure(res, error); }
});
demoProfessionalRouter.get("/workspaces/:workspaceId/patients/:patientId/invitation", async (req, res) => {
  try { ids(req); res.json({ invitation: await actorService(req).invitation(user(req), req.params.workspaceId, req.params.patientId) }); }
  catch (error) { failure(res, error); }
});
demoProfessionalRouter.post("/workspaces/:workspaceId/patients/:patientId/invitation", async (req, res) => {
  if (!z.object({}).strict().safeParse(req.body ?? {}).success) return res.status(400).json({ code: "DEMO_INVALID_INVITATION" });
  try { ids(req); res.json({ invitation: await actorService(req).invite(user(req), req.params.workspaceId, req.params.patientId), delivery: "synthetic_simulation_only" }); }
  catch (error) { failure(res, error); }
});
demoProfessionalRouter.post("/workspaces/:workspaceId/patients/:patientId/invitation/accept", async (req, res) => {
  const input = z.object({ key: z.string().trim().min(1).max(128) }).strict().safeParse(req.body);
  if (!input.success) return res.status(400).json({ code: "DEMO_INVALID_INVITATION" });
  try { ids(req); res.json({ invitation: await actorService(req).acceptInvitation(user(req), req.params.workspaceId, req.params.patientId, input.data.key), synthetic: true }); }
  catch (error) { failure(res, error); }
});
demoProfessionalRouter.get("/context", async (req, res) => {
  try { res.json(await actorService(req).context(user(req))); } catch (error) { failure(res,error); }
});
demoProfessionalRouter.post("/acknowledgment", async (req, res) => {
  if (!z.object({ version: z.literal(DEMO_ACKNOWLEDGMENT_VERSION), syntheticOnlyAcknowledged: z.literal(true) }).strict().safeParse(req.body).success) return res.status(400).json({ code: "DEMO_ACKNOWLEDGMENT_REQUIRED" });
  try { res.json(await actorService(req).acknowledge(user(req))); } catch (error) { failure(res,error); }
});
demoProfessionalRouter.get("/workspaces/:workspaceId/patients", async (req, res) => {
  try { ids(req); res.json({ patients: await actorService(req).list(user(req),req.params.workspaceId) }); } catch (error) { failure(res,error); }
});
demoProfessionalRouter.get("/workspaces/:workspaceId/patients/:patientId", async (req, res) => {
  try { ids(req); res.json(await actorService(req).read(user(req),req.params.workspaceId,req.params.patientId)); } catch (error) { failure(res,error); }
});
demoProfessionalRouter.put("/workspaces/:workspaceId/patients/:patientId/plan", async (req, res) => {
  const input = demoPlanInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ code: "DEMO_INVALID_PLAN", error: "Only structured synthetic demonstration choices are accepted." });
  try { ids(req); res.json(await actorService(req).savePlan(user(req),req.params.workspaceId,req.params.patientId,input.data)); } catch (error) { failure(res,error); }
});
for (const kind of ["messages","media","export"] as const) demoProfessionalRouter.get(`/workspaces/:workspaceId/patients/:patientId/${kind}`, async (req, res) => {
  try {
    ids(req); const args = [user(req), req.params.workspaceId, req.params.patientId] as const;
    const result = await actorService(req)[kind === "media" ? "mediaList" : kind](...args);
    if (kind === "export") res.set("Content-Disposition", 'attachment; filename="synthetic-patient-demo.json"');
    res.json(kind === "export" ? result : { [kind]: result });
  } catch (error) { failure(res,error); }
});
demoProfessionalRouter.get("/workspaces/:workspaceId/patients/:patientId/media/:mediaId", async (req, res) => {
  try {
    ids(req); const media = await actorService(req).media(user(req),req.params.workspaceId,req.params.patientId,req.params.mediaId);
    res.json({ ...media, classification: "synthetic" });
  } catch (error) { failure(res,error); }
});
demoProfessionalAdminRouter.use(noAuthoritySelectors, requireAuth, requireProfessionalIdentityReviewer);
demoProfessionalAdminRouter.get("/accounts/:userId", async (req,res) => {
  try { res.json({ grant: await readDemoRestriction(req.params.userId), events: await readDemoGrantHistory(req.params.userId),
    accountTransitionsEnabled: process.env.DEMO_ACCOUNT_TRANSITIONS_ENABLED === "true",
    transitionBlocker: "Separate activation approval and protection of every shared-Neon authentication runtime are required." }); }
  catch(error) { failure(res,error); }
});
// Stage 3 prepares the mechanism, NOT an actual shared-account transition.
// A client flag cannot open this release gate. Stage 4 needs separate approval
// and the shared-runtime live-data boundary before enabling these writers.
// Revocation remains possible while new preparations/activations are locked.
demoProfessionalAdminRouter.post("/accounts/:userId/revoke", async (req,res) => {
  const input = demoGrantRevocationInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ code:"DEMO_INVALID_GRANT" });
  try { res.json({ grant: await service.revoke((req as any).identityReviewer as IdentityReviewerProof,req.params.userId,input.data.revision,input.data.reason), reauthenticationRequired:true }); } catch(error) { failure(res,error); }
});
demoProfessionalAdminRouter.use((_req,res,next) => {
  if (process.env.DEMO_ACCOUNT_TRANSITIONS_ENABLED === "true") return next();
  return res.status(423).json({ code: "DEMO_ACCOUNT_TRANSITION_NOT_APPROVED",
    error: "Demo preparation and activation are locked pending separate approval and shared-runtime isolation." });
});
// Keep the bounded authorized writers implemented for that approved cutover.
demoProfessionalAdminRouter.post("/prepare", async (req,res) => {
  const input = demoGrantPreparationInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ code:"DEMO_INVALID_GRANT" });
  try { res.json({ grant: await service.prepare((req as any).identityReviewer as IdentityReviewerProof,input.data), reauthenticationRequired:true }); } catch(error) { failure(res,error); }
});
demoProfessionalAdminRouter.post("/accounts/:userId/activate", async (req,res) => {
  const input = demoGrantActivationInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ code:"DEMO_INVALID_GRANT" });
  try { res.json({ grant: await service.activate((req as any).identityReviewer as IdentityReviewerProof,req.params.userId,input.data), reauthenticationRequired:true }); } catch(error) { failure(res,error); }
});
