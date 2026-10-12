import { Router, type RequestHandler } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { guidedJourneyRepository } from "../services/guidedJourney/repository";
import { createGuidedJourneyService, type JourneyRepository } from "../services/guidedJourney/service";

export function guidedJourneyDevelopmentEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT;
}

/** Self-only inspection endpoint; no journey writes or UI activation. */
export function createGuidedJourneyRouter(
  repository: JourneyRepository = guidedJourneyRepository,
  authenticate: RequestHandler = requireAuth,
  enabled: () => boolean = guidedJourneyDevelopmentEnabled,
) {
  const router = Router();
  const service = createGuidedJourneyService(repository);
  router.use((_req, res, next) => {
    if (!enabled()) { res.status(404).json({ message: "Not found" }); return; }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/progress", authenticate, async (req, res) => {
    // No actor, subject, namespace, Builder, or workspace overrides.
    if (Object.keys(req.query).length) {
      res.status(400).json({ message: "This endpoint inspects only your personal account." });
      return;
    }
    const actor = (req as AuthenticatedRequest).authUser;
    if (!actor?.id) { res.status(401).json({ message: "Authentication required" }); return; }
    try {
      const snapshot = await service.inspect({
        id: actor.id, role: actor.role, professionalRole: actor.professionalRole,
        isSandbox: actor.isSandbox,
        // Reuse the existing requireActiveAccess decision for personal Builders.
        // This recommendation never grants destination access.
        mealPlanningAccess: actor.accessTier === "PAID_FULL" ? "allowed"
          : actor.accessTier === "FREE" ? "denied" : "unknown",
      });
      res.json(snapshot);
    } catch {
      res.status(503).json({ message: "Your setup progress could not be checked." });
    }
  });
  return router;
}
