import express from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { sql } from "drizzle-orm";

const router = express.Router();

router.get("/users/:userId/app-preferences", requireAuth, async (req, res) => {
  try {
    const authUserId = (req as AuthenticatedRequest).authUser?.id;
    const { userId } = req.params;
    if (authUserId !== userId) return res.status(403).json({ error: "Access denied" });

    const [row] = await db
      .select({ appPreferences: sql<Record<string, unknown>>`app_preferences` })
      .from(users)
      .where(eq(users.id, userId));

    res.json(row?.appPreferences || {});
  } catch (e: any) {
    console.error("get app-preferences error:", e);
    res.status(500).json({ error: e.message || "Failed to load preferences" });
  }
});

router.patch("/users/:userId/app-preferences", requireAuth, async (req, res) => {
  try {
    const authUserId = (req as AuthenticatedRequest).authUser?.id;
    const { userId } = req.params;
    if (authUserId !== userId) return res.status(403).json({ error: "Access denied" });

    const patch = req.body;
    if (typeof patch !== "object" || Array.isArray(patch)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    await db.execute(sql`
      UPDATE users
      SET app_preferences = COALESCE(app_preferences, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
      WHERE id = ${userId}
    `);

    res.json({ ok: true });
  } catch (e: any) {
    console.error("patch app-preferences error:", e);
    res.status(500).json({ error: e.message || "Failed to save preferences" });
  }
});

export default router;
