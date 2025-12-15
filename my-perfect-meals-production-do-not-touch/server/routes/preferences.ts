import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET preferences (includes notifications)
router.get("/users/:userId/preferences", async (req, res) => {
  try {
    const { userId } = req.params;
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    
    if (!user) {
      return res.json({ 
        notifications: { 
          enabled: false, 
          defaultLeadTimeMinutes: 30 
        } 
      });
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

// PUT preferences (partial)
router.put("/users/:userId/preferences", async (req, res) => {
  try {
    const { userId } = req.params;
    const body = req.body?.notifications || {};
    const update: any = {};
    
    if (typeof body.enabled === "boolean") {
      update.notificationsEnabled = body.enabled;
    }
    if (typeof body.defaultLeadTimeMinutes === "number") {
      update.notificationDefaultLeadTimeMin = body.defaultLeadTimeMinutes;
    }

    // Update existing user record
    await db.update(users).set(update).where(eq(users.id, userId));
    
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to update user preferences:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;