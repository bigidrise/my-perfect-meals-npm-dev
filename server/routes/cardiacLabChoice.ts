import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { discontinueLabDrivenCardiac, getPhysicianLockStatus } from "../services/labProtocolOwnership";
import { invalidatePrefix } from "../services/queryCache";

/** A subject may stop lab-derived Cardiac guidance without changing their lab results. */
export default function cardiacLabChoiceRouter() {
  const router = Router();
  router.patch("/lab-cardiac-support", requireAuth, async (req, res) => {
    if (!req.body || req.body.enabled !== false || Object.keys(req.body).length !== 1) {
      return res.status(400).json({ message: "Choose a valid Cardiac support setting." });
    }
    const userId = (req as AuthenticatedRequest).authUser.id;
    try {
      if (await getPhysicianLockStatus(userId, true)) {
        return res.status(403).json({
          message: "This protocol is controlled by your physician. Contact your care team to change it.",
        });
      }
      const specialtyConditions = await discontinueLabDrivenCardiac(userId);
      invalidatePrefix(`profile:${userId}`);
      return res.json({
        ok: true, specialtyConditions,
        message: "Cardiac support is off. Your lab values were not changed. You can turn it back on in Edit Profile.",
      });
    } catch {
      return res.status(503).json({ message: "Cardiac support could not be turned off. Please try again." });
    }
  });
  return router;
}