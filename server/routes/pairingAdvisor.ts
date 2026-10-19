import { Router, type RequestHandler } from "express";
import { parseAdvisorRequest } from "../../shared/pairingAdvisor/conversation";
import { developmentAdvisorAllowed } from "../services/pairingAdvisor/policy";
import { orchestrateAdvisor, type SyntheticOrchestration } from "../services/pairingAdvisor/orchestrator";
import { createAdvisorRequestLimits } from "../services/pairingAdvisor/requestLimits";

export const ADVISOR_PATH = "/api/ai/pairing-advisor";
export type RuntimeSnapshot = { nodeEnv?: string; deploymentMarker?: string };
export type AdvisorRouterOptions = {
  getRuntime: () => RuntimeSnapshot;
  security: { authenticate: RequestHandler; activeAccess: RequestHandler; proAccess: RequestHandler };
  synthetic?: SyntheticOrchestration;
  limits?: ReturnType<typeof createAdvisorRequestLimits>;
};

export function createAdvisorRouter(options: AdvisorRouterOptions) {
  const router = Router();
  const limits = options.limits ?? createAdvisorRequestLimits();
  // Handler-time guard covers direct use and environment changes after registration.
  router.use((_req, res, next) => {
    if (!developmentAdvisorAllowed(options.getRuntime())) {
      res.status(404).json({ error: "Advisor unavailable", code: "ADVISOR_DISABLED" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (options.synthetic?.mode !== "synthetic_test_only") {
      // Application default: do not authenticate/load a real profile or expose fixture content.
      res.status(503).json({ error: "Advisor integration is not activated", code: "ADVISOR_NOT_ACTIVATED" });
      return;
    }
    next();
  });
  router.post("/", options.security.authenticate, options.security.activeAccess, options.security.proAccess,
    async (req, res) => {
      const accountId = (req as typeof req & { authUser?: { id?: string } }).authUser?.id;
      if (typeof accountId !== "string" || !accountId.trim()) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const lease = limits.acquire(accountId);
      if (!lease.accepted) {
        res.setHeader("Retry-After", String(lease.retryAfterSeconds));
        res.status(429).json({ error: "Advisor request limit reached", code: lease.reason });
        return;
      }
      try {
        let request;
        try { request = parseAdvisorRequest(req.body); }
        catch {
          res.status(400).json({ error: "Invalid advisor request", code: "ADVISOR_REQUEST_INVALID" });
          return;
        }
        const response = await orchestrateAdvisor(accountId, request, options.synthetic);
        if (!developmentAdvisorAllowed(options.getRuntime())) {
          res.status(404).json({ error: "Advisor unavailable", code: "ADVISOR_DISABLED" });
          return;
        }
        // Synthetic harness transport ONLY. Not approval of future live endpoint HTTP mapping.
        res.status(response.outcome === "unavailable" ? 503 : 200).json(response);
      } finally {
        lease.release();
      }
    });
  return router;
}
