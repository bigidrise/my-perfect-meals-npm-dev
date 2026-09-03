import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

router.get("/users/:userId/preferences", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { userId } = req.params;
    if (userId !== authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) {
      return res.json({ notifications: { enabled: false, defaultLeadTimeMinutes: 30 } });
    }
    return res.json({
      notifications: {
        enabled: !!user.notificationsEnabled,
        defaultLeadTimeMinutes: user.notificationDefaultLeadTimeMin ?? 30,
      },
    });
  } catch (error: any) {
    console.error("Failed to get user preferences:", error);
    res.status(500).json({ message: error.message });
  }
});

router.put("/users/:userId/preferences", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { userId } = req.params;
    if (userId !== authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const body = req.body?.notifications || {};
    const update: any = {};
    if (typeof body.enabled === "boolean") {
      update.notificationsEnabled = body.enabled;
    }
    if (typeof body.defaultLeadTimeMinutes === "number") {
      update.notificationDefaultLeadTimeMin = body.defaultLeadTimeMinutes;
    }
    await db.update(users).set(update).where(eq(users.id, userId));
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to update user preferences:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
