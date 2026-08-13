/**
 * chefBudget.ts — POST /api/meals/chef-budget
 *
 * Resolves and returns the server-authoritative per-meal budget for the
 * Create-with-Chef generation path. Mounted BEFORE the full generation
 * endpoint so clients can pre-fetch the enforced budget and the tests can
 * exercise the enforcement logic independently of the OpenAI pipeline.
 *
 * Auth: requireAuth — budget defaults to the authenticated user.
 *
 * ProCare physician-for-client delegation:
 *   When a physician sends proClientId in the body the server validates the
 *   active care-team relationship and resolves the budget against the CLIENT's
 *   DailyNutritionState. Unauthorized proClientId values return HTTP 403.
 */

import express from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireEssentialAccess } from "../middleware/requireEssentialAccess";
import { resolveChefBudget } from "../services/chefBudgetService";
import { verifyPhysicianClientAccess } from "../services/procareAccessService";

const router = express.Router();

/**
 * POST /api/meals/chef-budget
 *
 * Body:
 *   dateISO?           string   YYYY-MM-DD (builder active day; defaults to today UTC)
 *   generationContext? string   client hint (e.g. "performance_training_day")
 *   proClientId?       string   ProCare client user ID; triggers care-team auth check
 *   requestedUserId?   string   IGNORED — budget resolves for authUser or authorized client
 *
 * Response 200: { remainingMacros, starchAllowed, budget }
 * Response 400: dateISO format invalid
 * Response 403: proClientId present but physician has no active care-team link
 * Response 503: nutrition state could not be resolved
 */
router.post("/", requireAuth, requireEssentialAccess, async (req, res) => {
  const authUserId = String((req as AuthenticatedRequest).authUser.id);

  const { dateISO: rawDate, generationContext, proClientId } = req.body;
  const dateISO: string = rawDate ?? new Date().toISOString().split("T")[0];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return res.status(400).json({ error: "dateISO must be YYYY-MM-DD" });
  }

  // ── ProCare physician-for-client delegation ────────────────────────────────
  // Validate org isolation + care-team authorization before switching budget
  // resolution to the client's DailyNutritionState. physicianId always comes
  // from the session — never from untrusted body fields.
  // verifyPhysicianClientAccess throws OrgIsolationError on cross-org access.
  let budgetUserId = authUserId;
  if (proClientId && typeof proClientId === "string") {
    try {
      const hasAccess = await verifyPhysicianClientAccess(authUserId, proClientId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to access this client's nutrition budget.",
          source: "access_denied",
        });
      }
      budgetUserId = proClientId;
    } catch (err) {
      const { handleOrgIsolationError } = await import("../lib/orgIsolation");
      const handled = handleOrgIsolationError(err, res);
      if (!handled) {
        // Not an org-isolation error — fail closed; send 503 explicitly so
        // the request is not left unresolved.
        return res.status(503).json({
          success: false,
          error: "Authorization check failed. Please try again.",
          source: "auth_error",
        });
      }
      return;
    }
  }

  try {
    const result = await resolveChefBudget(
      budgetUserId,
      dateISO,
      typeof generationContext === "string" ? generationContext : undefined,
    );

    console.log(
      `🥗 [ChefBudget] authUserId=${authUserId} budgetUserId=${budgetUserId} date=${dateISO} ` +
      `cal=${result.budget.caloriesTarget} starch=${result.starchAllowed}`,
    );

    res.json(result);
  } catch (err) {
    console.error("[ChefBudget] Resolution failed:", err);
    res.status(503).json({
      error: "Nutrition budget could not be resolved. Please try again.",
      source: "budget_error",
    });
  }
});

export default router;
