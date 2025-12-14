import { Router } from "express";
import { db } from "../db";
import { notificationJobs } from "../../shared/schema";
import { and, eq, gt, sql } from "drizzle-orm";

const router = Router();

// Get next scheduled reminder for a user
router.get("/notify/next", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const now = new Date();
    const [row] = await db.select().from(notificationJobs)
      .where(and(
        eq(notificationJobs.userId, userId),
        eq(notificationJobs.status, "scheduled"),
        gt(notificationJobs.fireAtUtc, now)
      ))
      .orderBy(sql`${notificationJobs.fireAtUtc} ASC`)
      .limit(1);

    if (!row) {
      return res.json(null);
    }

    res.json({ 
      time: row.fireAtUtc.toISOString(), 
      slot: row.slot 
    });
  } catch (error) {
    console.error("Error fetching next reminder:", error);
    res.status(500).json({ error: "Failed to fetch next reminder" });
  }
});

// Disable all reminders for today
router.post("/notify/disable-today", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    await db.update(notificationJobs)
      .set({ status: "skipped" })
      .where(and(
        eq(notificationJobs.userId, userId),
        eq(notificationJobs.status, "scheduled"),
        sql`${notificationJobs.fireAtUtc} >= ${start.toISOString()} AND ${notificationJobs.fireAtUtc} <= ${end.toISOString()}`
      ));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error disabling today's reminders:", error);
    res.status(500).json({ error: "Failed to disable reminders" });
  }
});

export default router;