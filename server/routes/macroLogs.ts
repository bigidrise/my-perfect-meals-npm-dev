import express from "express";
import { db } from "../db";
import { macroLogs } from "../../shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";
import { clientLinks } from "../db/schema/procare";

const router = express.Router();

// POST /api/macros - Log macros with starchy/fibrous carb support
router.post("/macros", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const {
      at,
      source = "quick",
      kcal = 0,
      protein = 0,
      carbs = 0,
      fat = 0,
      fiber = 0,
      alcohol = 0,
      starchyCarbs = 0,
      fibrousCarbs = 0,
    } = req.body ?? {};

    const when = at ? new Date(at) : new Date();

    const [row] = await db
      .insert(macroLogs)
      .values({
        userId,
        at: when,
        source,
        kcal: String(kcal),
        protein: String(protein),
        carbs: String(carbs),
        fat: String(fat),
        fiber: String(fiber),
        alcohol: String(alcohol),
        starchyCarbs: String(starchyCarbs),
        fibrousCarbs: String(fibrousCarbs),
      })
      .returning();

    res.json(row);
  } catch (e) {
    console.error("create macro-log error", e);
    res.status(500).json({ error: "Failed to create macro log" });
  }
});

// GET /api/macros - Get macro totals for date range
router.get("/macros", requireAuth, async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    const requestedUserId = String(req.query.userId || "");

    // Caller must be the user themselves, or a linked pro
    if (requestedUserId && requestedUserId !== authUserId) {
      const [link] = await db
        .select({ id: clientLinks.id })
        .from(clientLinks)
        .where(
          and(
            eq(clientLinks.clientUserId, requestedUserId),
            eq(clientLinks.proUserId, authUserId),
            eq(clientLinks.active, true)
          )
        )
        .limit(1);
      if (!link) {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const userId = requestedUserId || authUserId;
    const from = req.query.from ? new Date(String(req.query.from)) : new Date("1970-01-01");
    const to = req.query.to ? new Date(String(req.query.to)) : new Date("2999-12-31");

    const rows = await db
      .select({
        kcal: sql<number>`COALESCE(SUM(${macroLogs.kcal}), 0)`,
        protein: sql<number>`COALESCE(SUM(${macroLogs.protein}), 0)`,
        carbs: sql<number>`COALESCE(SUM(${macroLogs.carbs}), 0)`,
        fat: sql<number>`COALESCE(SUM(${macroLogs.fat}), 0)`,
        starchyCarbs: sql<number>`COALESCE(SUM(${macroLogs.starchyCarbs}), 0)`,
        fibrousCarbs: sql<number>`COALESCE(SUM(${macroLogs.fibrousCarbs}), 0)`,
      })
      .from(macroLogs)
      .where(
        and(
          eq(macroLogs.userId, userId),
          gte(macroLogs.at, from),
          lte(macroLogs.at, to)
        )
      );

    res.json(rows[0] || { kcal: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0 });
  } catch (e) {
    console.error("get macro totals error", e);
    res.status(500).json({ error: "Failed to fetch macro totals" });
  }
});

export default router;
