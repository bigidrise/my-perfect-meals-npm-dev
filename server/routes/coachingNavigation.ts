import { Router, type RequestHandler } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";
import { requireClinicalAccess } from "../middleware/requireClinicalAccess";
import { requirePurchasedPlanEntitlement } from "../middleware/requirePurchasedPlanEntitlement";
import { COACH_DESTINATIONS, isCoachDestinationId } from "../../shared/coaching/navigation";
import { chefNavigationRoute } from "../../shared/coaching/creatorRequest";
import { requireEssentialAccess } from "../middleware/requireEssentialAccess";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { getTierForLookupKey, PLAN_FEATURES } from "../../shared/planFeatures";
import { isAskChefConversationEnabled } from "../../shared/coaching/askChefRelease";

const hydrationAccess = requirePurchasedPlanEntitlement("hydration_center");
// Match the existing MealBuildersGuard permission matrix, including established
// founder/internal access. Opening this landing page never unlocks a builder.
const mealBuildersAccess: RequestHandler = (req, res, next) => {
  const user = (req as AuthenticatedRequest).authUser;
  const tier = getTierForLookupKey(user?.planLookupKey);
  if (user && (user.isFounder ||
    (user.accessTier === "PAID_FULL" && tier === "free") ||
    PLAN_FEATURES[tier]?.entitlements.includes("smart_menu_builder"))) {
    next();
    return;
  }
  res.status(403).json({ error: "Meal Builders requires Essential access or higher", code: "PLAN_REQUIRED" });
};
const router = Router();

// Recheck current authoritative access at click time. Destination guards still run.
const resolve: RequestHandler = (req, res, next) => {
  if (!isAskChefConversationEnabled(process.env.NODE_ENV)) {
    res.status(404).json({ error: "Chef navigation is not available in this environment." });
    return;
  }
  const id = req.body?.destinationId;
  if (!isCoachDestinationId(id)) {
    res.status(400).json({ error: "That Chef recommendation is unavailable." });
    return;
  }
  const destination = COACH_DESTINATIONS[id];
  let route: string;
  try { route = chefNavigationRoute(id, req.body?.creatorRequest); }
  catch {
    res.status(400).json({ error: "That creator request is unavailable." });
    return;
  }
  const approved = () => res.json({ destinationId: id, route });
  const guard = destination.access === "hydration" ? hydrationAccess
    : destination.access === "essential" ? requireEssentialAccess
    : destination.access === "meal_builders" ? mealBuildersAccess
    : destination.access === "clinical" ? requireClinicalAccess
    : destination.access === "pro" ? requireProAccess : null;
  if (!guard) { approved(); return; }
  try { guard(req, res, approved); } catch (error) { next(error); }
};

// Remove only Chef's outer paywall; resolve still enforces the
// destination's original Essential/Pro/Clinical/purchased-entitlement guard.
router.post("/navigation", requireAuth, resolve);
export default router;
