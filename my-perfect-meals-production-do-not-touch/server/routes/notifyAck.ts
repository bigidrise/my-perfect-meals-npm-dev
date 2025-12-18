import { Router } from "express";
import { db } from "../db";
import { notificationJobs, adherenceEvents } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { enqueueNotifyJob } from "../queue/notifyQueue";

const router = Router();

router.post("/notify/ack", async (req, res) => {
  try {
    const { userId, jobId, action } = req.body; // 'ate'|'snooze'|'skip'
    const [j] = await db.select().from(notificationJobs).where(eq(notificationJobs.id, jobId));
    if (!j) return res.status(404).json({ error: "Job not found" });

    if (action === "snooze") {
      const fireAtUTC = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await enqueueNotifyJob({ userId, slot: j.slot, channel: j.channel as any, fireAtUTC });
      await db.update(notificationJobs).set({ status: "snoozed" }).where(eq(notificationJobs.id, jobId));
    } else {
      await db.update(notificationJobs).set({ 
        status: action === "ate" ? "ack" : "skipped" 
      }).where(eq(notificationJobs.id, jobId));
    }

    await db.insert(adherenceEvents).values({ 
      userId, 
      slot: j.slot, 
      action 
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Error acknowledging notification:", error);
    res.status(500).json({ error: "Failed to acknowledge notification" });
  }
});

export default router;