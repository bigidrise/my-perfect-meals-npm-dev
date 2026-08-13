/**
 * chefBudget.ts — POST /api/meals/chef-budget
 *
 * Resolves and returns the server-authoritative per-meal budget for the
 * Create-with-Chef generation path. Mounted BEFORE the full generation
 * endpoint so clients can pre-fetch the enforced budget and the tests can
 * exercise the enforcement logic independently of the OpenAI pipeline.
 *
 * Auth: requireAuth — budget is always for the authenticated user.
 * No ProCare delegation: physicians generate for themselves.
 */

import express from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireEssentialAccess } from "../middleware/requireEssentialAccess";
import { resolveChefBudget } from "../services/chefBudgetService";

const router = express.Router();

/**
 * POST /api/meals/chef-budget
 *
 * Body:
 *   dateISO?         string   YYYY-MM-DD (builder active day; defaults to today UTC)
 *   generationContext? string  client hint (e.g. "performance_training_day")
 *   requestedUserId?  string  IGNORED — budget always resolves for req.authUser.id
 *
 * Response 200: { remainingMacros, starchAllowed, budget }
 * Response 400: dateISO format invalid
 * Response 503: nutrition state could not be resolved
 */
router.post("/", requireAuth, requireEssentialAccess, async (req, res) => {
  const authUserId = String((req as AuthenticatedRequest).authUser.id);

  const { dateISO: rawDate, generationContext } = req.body;
  const dateISO: string = rawDate ?? new Date().toISOString().split("T")[0];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return res.status(400).json({ error: "dateISO must be YYYY-MM-DD" });
  }

  try {
    const result = await resolveChefBudget(
      authUserId,
      dateISO,
      typeof generationContext === "string" ? generationContext : undefined,
    );

    console.log(
      `🥗 [ChefBudget] authUserId=${authUserId} date=${dateISO} ` +
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
