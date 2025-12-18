import { Router } from "express";
import { enqueueNotifyJob } from "../queue/notifyQueue";
import { addNotifyJob } from "../db/repo.notify";

const router = Router();

/** Schedules a reminder 2 minutes from now on both channels (if enabled). */
router.post("/notify/quick-test", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const fireAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    
    for (const channel of ["push", "sms"] as const) {
      await enqueueNotifyJob({ 
        userId, 
        slot: "test-reminder", 
        channel, 
        fireAtUTC: fireAt 
      });
      
      await addNotifyJob(userId, "test-reminder", fireAt, channel, {
        message: "My Perfect Meals: Test notification is working! 🎉"
      });
    }
    
    res.json({ ok: true, fireAt });
  } catch (error) {
    console.error("Error scheduling quick test:", error);
    res.status(500).json({ error: "Failed to schedule test notification" });
  }
});

export default router;