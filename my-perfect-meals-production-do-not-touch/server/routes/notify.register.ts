import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Register push subscription for a user
router.post("/notify/register-push", async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription) {
      return res.status(400).json({ error: "userId and subscription are required" });
    }

    // Get current user
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get existing push tokens and deduplicate by endpoint
    const existingTokens: any[] = (user.pushTokens as any[]) || [];
    const newEndpoint = subscription.endpoint;
    
    // Remove any existing subscription with the same endpoint
    const filteredTokens = existingTokens.filter((token: any) => 
      token.endpoint !== newEndpoint
    );

    // Add the new subscription
    const updatedTokens = [...filteredTokens, subscription];

    // Update user record
    await db.update(users)
      .set({ pushTokens: updatedTokens })
      .where(eq(users.id, userId));

    console.log(`✅ Push subscription registered for user ${userId}`);
    res.json({ success: true, subscriptionsCount: updatedTokens.length });

  } catch (error) {
    console.error("❌ Failed to register push subscription:", error);
    res.status(500).json({ error: "Failed to register push subscription" });
  }
});

export default router;