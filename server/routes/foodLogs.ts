import express from "express";
import { db } from "../db";
import { foodDiary, insertFoodDiarySchema } from "../../shared/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

const router = express.Router();

// ── Auth on every route in this file ────────────────────────────────────────
// Food diary entries are patient-owned PHI. requireAuth is applied router-wide
// so no handler can be reached unauthenticated.
router.use(requireAuth);

/**
 * POST /api/food-logs
 * Creates a food diary entry. userId is always sourced from the authenticated
 * session — any userId in the body is overridden with the caller's own id.
 */
router.post("/food-logs", async (req, res) => {
  try {
    const callerUserId = (req as AuthenticatedRequest).authUser.id;

    const validation = insertFoodDiarySchema.safeParse({
      ...req.body,
      userId: callerUserId,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
    }

    const [row] = await db.insert(foodDiary).values(validation.data as any).returning();
    console.log("[food-log][create]", { saved: row });

    res.json(row);
  } catch (e: any) {
    console.error("create food-log error", e);
    return res.status(500).json({ error: "Failed to create food log" });
  }
});

/**
 * GET /api/food-logs
 * Returns food diary entries for the authenticated user only.
 * The userId query param is accepted for compatibility but must equal the
 * caller's own id — cross-user reads are rejected with 403.
 */
router.get("/food-logs", async (req, res) => {
  try {
    const callerUserId = (req as AuthenticatedRequest).authUser.id;

    const requestedUserId = String(req.query.userId || callerUserId);
    if (requestedUserId !== callerUserId) {
      return res.status(403).json({
        error: "Access denied: you may only read your own food logs.",
        code: "FOOD_LOG_AUTH_FORBIDDEN",
      });
    }

    const fromStr = (req.query.from as string) || null;
    const toStr = (req.query.to as string) || null;
    const limit = Math.min(Number(req.query.limit || 100), 200);

    const from = fromStr || "1970-01-01";
    const to = toStr || "2999-12-31";

    const whereParts: any[] = [
      eq(foodDiary.userId, callerUserId),
      gte(foodDiary.dateLocal, from),
      lte(foodDiary.dateLocal, to),
    ];

    const rows = await db
      .select()
      .from(foodDiary)
      .where(and(...whereParts))
      .orderBy(desc(foodDiary.dateLocal))
      .limit(limit);

    res.json({ items: rows });
  } catch (e: any) {
    console.error("get food-logs error", e);
    res.status(500).json({ error: "Failed to fetch food logs" });
  }
});

export default router;
