import { Router } from "express";
import { db } from "../db";
import { aiMealPlanArchive } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// GET /api/meal-plan-archive - List archived meal plans for user  
router.get("/meal-plan-archive", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = "test-user-123"; // Demo user ID - in real app would come from auth
    
    const plans = await db
      .select()
      .from(aiMealPlanArchive)
      .where(eq(aiMealPlanArchive.userId, userId))
      .orderBy(desc(aiMealPlanArchive.createdAt))
      .limit(limit);
    
    res.json(plans);
  } catch (error) {
    console.error("Error fetching meal plans:", error);
    res.status(500).json({ error: "Failed to fetch meal plans" });
  }
});

// GET /api/meal-plan-archive/:id - Get single meal plan
router.get("/meal-plan-archive/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const plan = await db
      .select()
      .from(aiMealPlanArchive)
      .where(eq(aiMealPlanArchive.id, id))
      .limit(1);
    
    if (plan.length === 0) {
      return res.status(404).json({ error: "Meal plan not found" });
    }
    
    res.json(plan[0]);
  } catch (error) {
    console.error("Error fetching meal plan:", error);
    res.status(500).json({ error: "Failed to fetch meal plan" });
  }
});

// POST /api/meal-plan-archive - Create/accept new meal plan
router.post("/meal-plan-archive", async (req, res) => {
  try {
    console.log("🎯 MEAL PLAN ARCHIVE ROUTE HIT!");
    const userId = "test-user-123"; // Demo user ID - in real app would come from auth
    
    console.log("Received meal plan data:", JSON.stringify(req.body, null, 2));
    
    // Create archive entry with correct aiMealPlanArchive schema structure
    const mealPlanData = {
      userId,
      title: req.body.title || "AI Generated Meal Plan",
      dietOverride: req.body.dietOverride || null,
      durationDays: req.body.durationDays || 7,
      mealsPerDay: req.body.mealsPerDay || 3,
      snacksPerDay: req.body.snacksPerDay || 0,
      selectedIngredients: req.body.selectedIngredients || [],
      schedule: req.body.schedule || [],
      slots: req.body.slots || [],
      status: req.body.status || "accepted"
    };
    
    console.log("Mapped meal plan data:", JSON.stringify(mealPlanData, null, 2));
    
    const [newPlan] = await db
      .insert(aiMealPlanArchive)
      .values(mealPlanData)
      .returning();
    
    console.log("Successfully created meal plan:", newPlan.id);
    res.status(201).json(newPlan);
  } catch (error) {
    console.error("Error creating meal plan:", error);
    console.error("Request body:", req.body);
    
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    res.status(400).json({ 
      error: "Failed to create meal plan",
      details: error instanceof Error ? error.message : String(error),
      requestBody: req.body
    });
  }
});

// DELETE /api/meal-plans/:id - Delete meal plan
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = "test-user-123"; // Demo user ID - in real app would come from auth
    
    const result = await db
      .delete(aiMealPlanArchive)
      .where(and(
        eq(aiMealPlanArchive.id, id),
        eq(aiMealPlanArchive.userId, userId)
      ))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Meal plan not found" });
    }
    
    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Error deleting meal plan:", error);
    res.status(500).json({ error: "Failed to delete meal plan" });
  }
});

// POST /api/meal-plans/:id/repeat - Repeat meal plan
router.post("/:id/repeat", async (req, res) => {
  try {
    const { id } = req.params;
    const { weeks = 1, startDate } = req.body;
    const userId = "test-user-123"; // Demo user ID - in real app would come from auth
    
    // Get original plan
    const originalPlan = await db
      .select()
      .from(aiMealPlanArchive)
      .where(and(
        eq(aiMealPlanArchive.id, id),
        eq(aiMealPlanArchive.userId, userId)
      ))
      .limit(1);
    
    if (originalPlan.length === 0) {
      return res.status(404).json({ error: "Meal plan not found" });
    }
    
    const plan = originalPlan[0];
    
    // Create new plan with updated title and dates
    const newPlan = {
      ...plan,
      title: `${plan.title} (Repeated)`,
      status: "accepted" as const,
      userId,
      // Note: In a real implementation, you'd shift the schedule dates based on startDate
    };
    
    delete (newPlan as any).id;
    delete (newPlan as any).createdAt;
    
    const [createdPlan] = await db
      .insert(aiMealPlanArchive)
      .values(newPlan)
      .returning();
    
    res.json({ id: createdPlan.id, newPlanIds: [createdPlan.id] });
  } catch (error) {
    console.error("Error repeating meal plan:", error);
    res.status(500).json({ error: "Failed to repeat meal plan" });
  }
});

export default router;