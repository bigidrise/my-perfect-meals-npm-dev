import { Router } from "express";
import { db } from "../db";
import { notificationJobs } from "../../shared/schema";
import { and, eq, gte } from "drizzle-orm";

const router = Router();

router.get("/adherence/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rows = await db.select().from(notificationJobs)
      .where(and(
        eq(notificationJobs.userId, userId),
        gte(notificationJobs.fireAtUtc, sevenDaysAgo)
      ));

    if (!rows.length) {
      return res.json({ percent: 0, ate: 0, total: 0 });
    }

    const ateCount = rows.filter(r => r.status === "ate").length;
    const total = rows.length;
    const percent = Math.round((ateCount / total) * 100);

    res.json({ percent, ate: ateCount, total });
  } catch (error) {
    console.error("Error fetching adherence data:", error);
    res.status(500).json({ error: "Failed to fetch adherence data" });
  }
});

export default router;