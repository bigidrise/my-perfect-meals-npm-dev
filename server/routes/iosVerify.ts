import { Router, Request, Response } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const IOS_PRODUCT_TO_PLAN: Record<string, string> = {
  mpm_basic_999_v2: "mpm_basic_monthly",
  mpm_premium_1999: "mpm_premium_monthly",
  mpm_ultimate_2999: "mpm_ultimate_monthly",
};

const PLAN_ENTITLEMENTS: Record<string, string[]> = {
  mpm_basic_monthly: [
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
  ],
  mpm_premium_monthly: [
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
    "restaurant_guide",
    "fridge_rescue",
    "potluck_planner",
    "holiday_feast",
    "learn_cook",
  ],
  mpm_ultimate_monthly: [
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
    "restaurant_guide",
    "fridge_rescue",
    "potluck_planner",
    "holiday_feast",
    "learn_cook",
    "lab_metrics",
    "care_team",
  ],
};

router.post("/verify-purchase", async (req: Request, res: Response) => {
  try {
    const { userId, transactionId, productId, internalSku } = req.body;

    if (!userId || !transactionId || !productId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("[iOS Verify] Processing purchase:", {
      userId,
      transactionId,
      productId,
      internalSku,
    });

    const planLookupKey = IOS_PRODUCT_TO_PLAN[productId] || internalSku;
    if (!planLookupKey) {
      return res.status(400).json({ error: "Unknown product ID" });
    }

    const entitlements = PLAN_ENTITLEMENTS[planLookupKey] || [];

    const [updatedUser] = await db
      .update(users)
      .set({
        planLookupKey,
        entitlements,
        subscriptionStatus: "active",
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("[iOS Verify] User updated:", {
      userId: updatedUser.id,
      planLookupKey,
      entitlements,
    });

    const safeUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      planLookupKey: updatedUser.planLookupKey,
      entitlements: updatedUser.entitlements,
    };

    return res.json({
      success: true,
      user: safeUser,
      plan: planLookupKey,
    });
  } catch (error: any) {
    console.error("[iOS Verify] Error:", error);
    return res.status(500).json({ error: error.message || "Verification failed" });
  }
});

router.post("/restore-purchases", async (req: Request, res: Response) => {
  try {
    const { userId, entitlements } = req.body;

    if (!userId || !entitlements || !Array.isArray(entitlements)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (entitlements.length === 0) {
      return res.json({ success: true, message: "No purchases to restore" });
    }

    const highestTierProduct = entitlements.reduce((highest: string, productId: string) => {
      const tierOrder = ["mpm_ultimate_2999", "mpm_premium_1999", "mpm_basic_999_v2"];
      const currentIndex = tierOrder.indexOf(productId);
      const highestIndex = tierOrder.indexOf(highest);
      return currentIndex < highestIndex ? productId : highest;
    }, entitlements[0]);

    const planLookupKey = IOS_PRODUCT_TO_PLAN[highestTierProduct];
    if (!planLookupKey) {
      return res.status(400).json({ error: "Unknown product" });
    }

    const planEntitlements = PLAN_ENTITLEMENTS[planLookupKey] || [];

    const [updatedUser] = await db
      .update(users)
      .set({
        planLookupKey,
        entitlements: planEntitlements,
        subscriptionStatus: "active",
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const safeUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      planLookupKey: updatedUser.planLookupKey,
      entitlements: updatedUser.entitlements,
    };

    return res.json({
      success: true,
      user: safeUser,
      plan: planLookupKey,
      restoredProduct: highestTierProduct,
    });
  } catch (error: any) {
    console.error("[iOS Restore] Error:", error);
    return res.status(500).json({ error: error.message || "Restore failed" });
  }
});

export default router;
