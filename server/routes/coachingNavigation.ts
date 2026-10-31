import { Router, type RequestHandler } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";
import { requireClinicalAccess } from "../middleware/requireClinicalAccess";
import { requirePurchasedPlanEntitlement } from "../middleware/requirePurchasedPlanEntitlement";
import { COACH_DESTINATIONS, isCoachDestinationId } from "../../shared/coaching/navigation";

const hydrationAccess = requirePurchasedPlanEntitlement("hydration_center");
const router = Router();

// Recheck current authoritative access at click time. Destination guards still run.
const resolve: RequestHandler = (req, res, next) => {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).json({ error: "Chef navigation is not available in this environment." });
    return;
  }
  const id = req.body?.destinationId;
  if (!isCoachDestinationId(id)) {
    res.status(400).json({ error: "That Chef recommendation is unavailable." });
    return;
  }
  const destination = COACH_DESTINATIONS[id];
  const approved = () => res.json({ destinationId: id, route: destination.route });
  const guard = destination.access === "hydration" ? hydrationAccess
    : destination.access === "clinical" ? requireClinicalAccess
    : destination.access === "pro" ? requireProAccess : null;
  if (!guard) { approved(); return; }
  try { guard(req, res, approved); } catch (error) { next(error); }
};

router.post("/navigation", requireAuth, resolve);
export default router;
