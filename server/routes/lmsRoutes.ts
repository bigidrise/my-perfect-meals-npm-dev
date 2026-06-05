import express from "express";
import { db } from "../db";
import { eq, and, asc, isNotNull } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { lmsUpdateModules, userLmsUpdates } from "../db/schema/lms";

const router = express.Router();

router.use(requireAuth);

// GET /api/lms/updates — list all released updates with user completion status
router.get("/updates", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const updates = await db
      .select()
      .from(lmsUpdateModules)
      .where(isNotNull(lmsUpdateModules.releasedAt))
      .orderBy(asc(lmsUpdateModules.releasedAt));

    if (updates.length === 0) {
      return res.json({ updates: [], pendingCount: 0 });
    }

    const userProgress = await db
      .select()
      .from(userLmsUpdates)
      .where(eq(userLmsUpdates.userId, userId));

    const progressMap = new Map(userProgress.map((p) => [p.updateModuleId as string, p]));

    const result = updates.map((u) => {
      const progress = progressMap.get(u.id as string);
      return {
        ...u,
        userProgress: {
          videoWatched: progress?.videoWatched ?? false,
          completed: progress?.completed ?? false,
          completedAt: progress?.completedAt ?? null,
        },
      };
    });

    const pendingCount = result.filter((u) => u.isRequired && !u.userProgress.completed).length;

    return res.json({ updates: result, pendingCount });
  } catch (err) {
    console.error("[LMS] updates GET error:", err);
    return res.status(500).json({ error: "Failed to fetch updates" });
  }
});

// POST /api/lms/updates/:id/watch — mark video as watched
router.post("/updates/:id/watch", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { id } = req.params;

    await db
      .insert(userLmsUpdates)
      .values({ userId, updateModuleId: id, videoWatched: true })
      .onConflictDoUpdate({
        target: [userLmsUpdates.userId, userLmsUpdates.updateModuleId],
        set: { videoWatched: true },
      });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[LMS] watch error:", err);
    return res.status(500).json({ error: "Failed to mark watched" });
  }
});

// POST /api/lms/updates/:id/complete — mark update as completed
router.post("/updates/:id/complete", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { id } = req.params;

    await db
      .insert(userLmsUpdates)
      .values({ userId, updateModuleId: id, videoWatched: true, completed: true, completedAt: new Date() })
      .onConflictDoUpdate({
        target: [userLmsUpdates.userId, userLmsUpdates.updateModuleId],
        set: { videoWatched: true, completed: true, completedAt: new Date() },
      });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[LMS] complete error:", err);
    return res.status(500).json({ error: "Failed to mark complete" });
  }
});

export default router;
