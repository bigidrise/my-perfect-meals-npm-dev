import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { updateProfessionalDraft, submitProfessionalDraft, type ProfessionalDraftFields } from "@shared/professionalOnboarding";
import { createProfessionalOnboardingService, ProfessionalRequestError, type ProfessionalRequestRepository } from "../services/professionalOnboardingService";
import { professionalOnboardingRepository } from "../services/professionalOnboardingRepository";

export function createProfessionalOnboardingRouter(repository: ProfessionalRequestRepository) {
  const router = Router();
  const service = createProfessionalOnboardingService(repository);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production" || ["1", "true"].includes(process.env.REPLIT_DEPLOYMENT ?? "")) {
      return res.status(404).json({ code: "PROFESSIONAL_REQUESTS_NOT_ENABLED", error: "Professional requests are not enabled in this environment." });
    }
    next();
  });
  router.use(requireAuth);
  router.use((req, res, next) => {
    if (Object.keys(req.query).length) return res.status(400).json({ code: "INVALID_REQUEST", error: "Onboarding endpoints accept no account or request query parameters." });
    next();
  });
  function handler(action: "status" | "resume" | "update" | "submit") {
    return async (req: any, res: any) => {
      try {
        const id = (req as AuthenticatedRequest).authUser.id;
        const schema = action === "update" ? updateProfessionalDraft : action === "submit" ? submitProfessionalDraft : z.object({}).strict();
        const parsed = schema.safeParse(req.body ?? {});
        if (!parsed.success) return res.status(400).json({ code: "INVALID_REQUEST", error: parsed.error.issues.map(issue => issue.message).join(" ") });
        const result = action === "status" ? await service.status(id)
          : action === "resume" ? await service.resume(id)
          : action === "update" ? await service.update(id, parsed.data as ProfessionalDraftFields & { revision: number; requestId?: string })
          : await service.submit(id, parsed.data as { revision: number; requestId?: string });
        res.json(result);
      } catch (error) {
        if (error instanceof ProfessionalRequestError) return res.status(error.status).json({ code: error.code, error: error.message });
        // Do not log credential payloads, SQL parameters, or connection details.
        console.error("[professional-onboarding] request storage unavailable");
        res.status(503).json({ code: "REQUEST_STORAGE_UNAVAILABLE", error: "Professional request storage is temporarily unavailable. Your account access has not changed. Please retry." });
      }
    };
  }
  router.get("/", handler("status"));
  router.post("/draft", handler("resume"));
  router.patch("/draft", handler("update"));
  router.post("/submit", handler("submit"));
  return router;
}
export default createProfessionalOnboardingRouter(professionalOnboardingRepository);
