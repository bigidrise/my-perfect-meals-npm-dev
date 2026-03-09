import { Router } from "express";
import { db } from "../db";
import { userMealPrefs, insertUserMealPrefsSchema } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";

export const userMealPrefsRouter = Router();

userMealPrefsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    
    const row = await db.query.userMealPrefs.findFirst({ 
      where: eq(userMealPrefs.userId, userId) 
    });
    
    const prefs = row ?? { 
      goal: "maint", 
      likesProtein: [], 
      likesCarb: [], 
      likesFat: [], 
      likesVeg: [], 
      avoid: [] 
    };
    
    res.json(prefs);
  } catch (error) {
    console.error("Failed to get user meal preferences:", error);
    res.status(500).json({ error: "Failed to get meal preferences" });
  }
});

userMealPrefsRouter.post("/", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    
    const { goal = "maint", likesProtein = [], likesCarb = [], likesFat = [], likesVeg = [], avoid = [] } = req.body ?? {};
    
    const validatedData = insertUserMealPrefsSchema.parse({
      userId,
      goal,
      likesProtein,
      likesCarb,
      likesFat,
      likesVeg,
      avoid
    });
    
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
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to update user meal preferences:", error);
    res.status(500).json({ error: "Failed to update meal preferences" });
  }
});
