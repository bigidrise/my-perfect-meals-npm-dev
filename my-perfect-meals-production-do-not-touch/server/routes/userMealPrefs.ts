import { Router } from "express";
import { db } from "../db";
import { userMealPrefs, insertUserMealPrefsSchema } from "../../shared/schema";
import { eq } from "drizzle-orm";

export const userMealPrefsRouter = Router();

// GET /api/user-prefs/meals - Get user meal preferences
userMealPrefsRouter.get("/", async (req, res) => {
  try {
    // Use fixed user ID for demo purposes
    const userId = "00000000-0000-0000-0000-000000000001";
    
    console.log("🎯 GET /api/user-prefs/meals for userId:", userId);
    
    const row = await db.query.userMealPrefs.findFirst({ 
      where: eq(userMealPrefs.userId, userId) 
    });
    
    // Return defaults if no preferences found
    const prefs = row ?? { 
      goal: "maint", 
      likesProtein: [], 
      likesCarb: [], 
      likesFat: [], 
      likesVeg: [], 
      avoid: [] 
    };
    
    console.log("✅ User meal preferences found:", prefs);
    res.json(prefs);
  } catch (error) {
    console.error("❌ Failed to get user meal preferences:", error);
    res.status(500).json({ error: "Failed to get meal preferences" });
  }
});

// POST /api/user-prefs/meals - Update user meal preferences
userMealPrefsRouter.post("/", async (req, res) => {
  try {
    // Use fixed user ID for demo purposes
    const userId = "00000000-0000-0000-0000-000000000001";
    
    console.log("🎯 POST /api/user-prefs/meals for userId:", userId, "body:", req.body);
    
    const { goal = "maint", likesProtein = [], likesCarb = [], likesFat = [], likesVeg = [], avoid = [] } = req.body ?? {};
    
    // Validate the input
    const validatedData = insertUserMealPrefsSchema.parse({
      userId,
      goal,
      likesProtein,
      likesCarb,
      likesFat,
      likesVeg,
      avoid
    });
    
    // Upsert the preferences
    await db.insert(userMealPrefs)
      .values({
        ...validatedData,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: userMealPrefs.userId,
        set: { 
          goal: validatedData.goal,
          likesProtein: validatedData.likesProtein,
          likesCarb: validatedData.likesCarb,
          likesFat: validatedData.likesFat,
          likesVeg: validatedData.likesVeg,
          avoid: validatedData.avoid,
          updatedAt: new Date() 
        },
      });
    
    console.log("✅ User meal preferences updated successfully");
    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Failed to update user meal preferences:", error);
    res.status(500).json({ error: "Failed to update meal preferences" });
  }
});