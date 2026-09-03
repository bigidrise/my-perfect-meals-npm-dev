/**
 * Daily Nutrition State API
 *
 * GET /api/nutrition-state/:dateISO
 *
 * Returns the complete DailyNutritionState for the authenticated user on the
 * given date: prescription + consumed (logged) + planned (board reservations
 * not yet logged) + remaining budget + meal plan config + active constraints.
 *
 * Auth: requireAuth — user always reads their own state (or ProCare physician
 * reads a client's state via ?clientId= after full authorization:
 *   1. Org isolation (assertSameOrg — cross-org access returns 403)
 *   2. Care-team relationship — active clientLink OR studio membership
 * This mirrors the authorization enforced by requireWorkspaceAccess and the
 * physician budget delegation path in chefBudget.ts.
 *
 * Query params:
 *   clientId  — ProCare client user ID (physician delegation; optional)
 *   timezone  — IANA timezone string (default: "UTC"). Used to compute which
 *               macro_logs belong to the requested calendar day.
 */

import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { resolveDailyNutritionState } from "../services/nutritionStateService";
import { verifyPhysicianClientAccess } from "../services/procareAccessService";
import { handleOrgIsolationError } from "../lib/orgIsolation";

const router = Router();

// ── Route ─────────────────────────────────────────────────────────────────────

router.get("/:dateISO", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;

    const authUserId = String(authUser.id);
    const requestedClientId = (req.query.clientId as string) ?? null;

    let userId = authUserId;

    if (requestedClientId && requestedClientId !== authUserId) {
      // Authorize via the centralized helper:
      //   • assertSameOrg — org isolation check (throws OrgIsolationError on violation)
      //   • clientLink OR studio membership — care-team relationship check
      let hasAccess: boolean;
      try {
        hasAccess = await verifyPhysicianClientAccess(authUserId, requestedClientId);
      } catch (err) {
        const handled = handleOrgIsolationError(err, res);
        if (!handled) {
          // Non-isolation error during authorization — fail closed
          console.error("[nutritionState] Authorization check failed:", err);
          return res.status(503).json({ error: "Authorization check failed. Please try again." });
        }
        return;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Not authorized to view this client's nutrition state" });
      }
      userId = requestedClientId;
    }

    const { dateISO } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    const state = await resolveDailyNutritionState(userId, dateISO);
    if (state.subject) {
      state.subject.accessMode = userId === authUserId ? "self" : "delegated";
    }
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    res.json(state);
  } catch (err: any) {
    if (err?.message?.startsWith("User not found")) {
      return res.status(404).json({ error: err.message });
    }
    console.error("[nutritionState] GET error:", err);
    res.status(500).json({ error: "Failed to resolve daily nutrition state" });
  }
});

export default router;
