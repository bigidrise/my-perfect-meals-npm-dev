import { Router } from "express";
import { z } from "zod";
import { ANTI_INFLAMMATORY_SUPPORT_ENABLED } from "../../shared/personalFoodSupportFreeze";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { readAntiInflammatorySupportPreference } from "../services/healthProtocols/developmentFoodSupports";
import { setPersonalAntiInflammatorySupport } from "../services/healthProtocols/persistence";

/** Exact personal support endpoint only; no experimental clinical router exposure.
 * Mounted behind the application's normal session/CSRF middleware in both servers. */
export default function antiInflammatorySupportRouter() {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!ANTI_INFLAMMATORY_SUPPORT_ENABLED) return res.status(404).json({ message: "Not found" });
    next();
  });
  router.use(requireAuth);
  router.get("/", async (req, res) => {
    try {
      return res.json(await readAntiInflammatorySupportPreference(
        (req as unknown as AuthenticatedRequest).authUser.id,
      ));
    } catch {
      return res.status(503).json({ message: "Anti-Inflammatory support could not be loaded. Please retry." });
    }
  });
  router.put("/", async (req, res) => {
    const body = z.object({ enabled: z.boolean() }).strict().safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: "Choose a valid support setting." });
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      await setPersonalAntiInflammatorySupport({
        actorUserId: subjectUserId, subjectUserId, enabled: body.data.enabled,
      });
      return res.json(await readAntiInflammatorySupportPreference(subjectUserId));
    } catch {
      return res.status(503).json({ message: "The support change could not be confirmed. Reload settings before trying again." });
    }
  });
  return router;
}
