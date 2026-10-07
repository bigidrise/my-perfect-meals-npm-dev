import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { professionalIdentityDecision, type ProfessionalIdentityDecision } from "@shared/professionalOnboarding";
import { requireAuth } from "../middleware/requireAuth";
import { requireProfessionalIdentityReviewer } from "../middleware/requireProfessionalIdentityReviewer";
import { createIdentityDecisionService, identitySnapshotHash, type IdentityReviewerProof } from "../services/professionalIdentityDecisionService";
import { identityDecisionRepository, listProfessionalReviewRequests, readProfessionalReviewRequest } from "../services/professionalIdentityDecisionRepository";
import { ProfessionalRequestError } from "../services/professionalOnboardingService";
import { getProfessionalIdentityReadiness } from "../services/professionalIdentityReadiness";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (process.env.NODE_ENV !== "development" || ["1", "true"].includes(process.env.REPLIT_DEPLOYMENT ?? "")) return res.status(404).json({ code: "IDENTITY_REVIEW_NOT_ENABLED" });
  next();
});
router.use(requireAuth, requireProfessionalIdentityReviewer);
router.use((req, res, next) => {
  if (Object.keys(req.query).length) return res.status(400).json({ code: "INVALID_REVIEW_INPUT", error: "Review endpoints accept no query parameters." });
  next();
});
function failure(res: Response, error: unknown) {
  if (error instanceof ProfessionalRequestError) return res.status(error.status).json({ code: error.code, error: error.message });
  return res.status(503).json({ code: "IDENTITY_REVIEW_UNAVAILABLE", error: "Review storage is unavailable. No successful decision has been confirmed. Reload status before retrying." });
}
router.get("/", async (_req, res) => {
  try { res.json({ requests: await listProfessionalReviewRequests() }); } catch (error) { failure(res, error); }
});
router.get("/:id", async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ code: "INVALID_REQUEST_ID" });
  try {
    const detail = await readProfessionalReviewRequest(req.params.id);
    if (!detail) throw new ProfessionalRequestError(404, "REQUEST_NOT_FOUND", "Request or account not found.");
    const events = await db.execute(sql`SELECT id, actor_user_id AS "actorUserId", event_type AS "eventType",
      request_revision AS "requestRevision", metadata, created_at AS "createdAt"
      FROM professional_identity_events WHERE request_id = ${req.params.id} ORDER BY request_revision`);
    let readiness = null;
    try { readiness = await getProfessionalIdentityReadiness(detail.account.id); } catch { /* Explicit unavailable projection; no assumed readiness. */ }
    res.json({ request: detail.request, currentAuthorizedRole: detail.account.professionalRole,
      currentProfessionalCategory: detail.account.professionalCategory,
      reviewedStateHash: identitySnapshotHash(detail.account), readiness,
      ...(!readiness && { readinessError: "READINESS_UNAVAILABLE" }),
      events: (events as { rows: unknown[] }).rows });
  } catch (error) { failure(res, error); }
});
const service = createIdentityDecisionService(identityDecisionRepository);
router.post("/:id/decision", async (req: Request, res: Response) => {
  const parsed = professionalIdentityDecision.safeParse(req.body);
  if (!z.string().uuid().safeParse(req.params.id).success || !parsed.success) return res.status(400).json({ code: "INVALID_DECISION", error: "A valid explicit review decision is required." });
  try {
    const proof = (req as Request & { identityReviewer: IdentityReviewerProof }).identityReviewer;
    const result = await service.decide(req.params.id, proof, parsed.data as ProfessionalIdentityDecision);
    // Decision already committed. A separate readiness read must never turn
    // success into an ambiguous mutation failure or manufacture readiness.
    let readiness = null;
    try { readiness = await getProfessionalIdentityReadiness(result.request.ownerUserId); } catch { /* Report unavailable, not ready. */ }
    res.json({ ...result, decisionSaved: true, readiness, ...(!readiness && { readinessError: "READINESS_UNAVAILABLE" }) });
  } catch (error) { failure(res, error); }
});
export default router;
