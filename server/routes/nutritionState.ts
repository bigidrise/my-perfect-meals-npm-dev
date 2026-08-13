/**
 * Daily Nutrition State API
 *
 * GET /api/nutrition-state/:dateISO
 *
 * Returns the complete DailyNutritionState for the authenticated user on the
 * given date: prescription + consumed (logged) + planned (board reservations
 * not yet logged) + remaining budget + meal plan config + active constraints.
 *
 * Auth: requireAuth — user always reads their own state (or ProCare coach
 * reads a client's state via ?clientId= after relationship verification).
 *
 * Query params:
 *   timezone  — IANA timezone string (default: "UTC"). Used to compute which
 *               macro_logs belong to the requested calendar day.
 */

import { Router } from "express";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { resolveDailyNutritionState } from "../services/nutritionStateService";
import { clientLinks } from "../db/schema/procare";

const router = Router();

// ── Route ─────────────────────────────────────────────────────────────────────

router.get("/:dateISO", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const authUserId = String(authUser.id);
    const requestedClientId = (req.query.clientId as string) ?? null;

    let userId = authUserId;

    if (requestedClientId && requestedClientId !== authUserId) {
      // Verify the requester is an active ProCare coach for this client.
      const link = await db
        .select({ id: clientLinks.id })
        .from(clientLinks)
        .where(
          and(
            eq(clientLinks.proUserId, authUserId),
            eq(clientLinks.clientUserId, requestedClientId),
            eq(clientLinks.active, true),
          ),
        )
        .limit(1);

      if (link.length === 0) {
        return res.status(403).json({ error: "Not authorized to view this client's nutrition state" });
      }
      userId = requestedClientId;
    }

    const { dateISO } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    const state = await resolveDailyNutritionState(userId, dateISO);
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
