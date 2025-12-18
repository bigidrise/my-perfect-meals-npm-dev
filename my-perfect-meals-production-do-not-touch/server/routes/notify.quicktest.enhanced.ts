import { Router } from "express";
import { enqueueNotifyJob } from "../queue/notifyQueue";
import { addNotifyJob } from "../db/repo.notify";

const router = Router();

// Enhanced quick test - schedule push/SMS for 2 minutes from now
router.post("/notify/quick-test", async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Schedule for 2 minutes from now
    const fireAt = new Date(Date.now() + 2 * 60 * 1000);
    const fireAtUTC = fireAt.toISOString();

    // Schedule both push and SMS (if user has them enabled)
    const channels = ["push"]; // Add "sms" when ready for SMS testing
    
    for (const channel of channels) {
      // Add to BullMQ for processing
      await enqueueNotifyJob({
        userId,
        slot: "quick-test",
        channel: channel as "push" | "sms",
        fireAtUTC
      });

      // Also store in database for tracking
      await addNotifyJob(userId, "quick-test", fireAtUTC, channel as "push" | "sms");
    }

    res.json({
      success: true,
      message: "Quick test scheduled for 2 minutes from now",
      fireAt: fireAtUTC,
      channels,
      localTime: fireAt.toLocaleString()
    });

  } catch (error) {
    console.error("❌ Failed to schedule quick test:", error);
    res.status(500).json({ error: "Failed to schedule quick test notification" });
  }
});

export default router;