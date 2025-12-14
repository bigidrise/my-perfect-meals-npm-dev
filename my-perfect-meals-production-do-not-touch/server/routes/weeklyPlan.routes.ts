import express from "express";
import { getWeeklyPlan, upsertWeeklyPlan, deleteWeeklyPlan, checkPlanExpiry, generateImmediatePlan } from "../db/repo.weeklyPlan";
// import { generateSingleMeal } from "../services/mealEngineService";

const router = express.Router();

// Legacy route removed - replaced by /api/meal-plan/current in mealPlans.routes.ts

// Save weekly plan with rolling dates
router.post("/meal-plan/save", async (req, res) => {
  try {
    const { userId, plan, params, planStartDate, planEndDate } = req.body;
    if (!userId || !plan) {
      return res.status(400).json({ error: "userId and plan required" });
    }
    
    const startDate = planStartDate ? new Date(planStartDate) : new Date();
    const endDate = planEndDate ? new Date(planEndDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await upsertWeeklyPlan(userId, plan, params || {}, startDate, endDate);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error saving weekly plan:", error);
    res.status(500).json({ error: "Failed to save weekly plan" });
  }
});

// Regenerate weekly plan using previous parameters
router.post("/meal-plan/regenerate", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    
    const existing = await getWeeklyPlan(userId);
    const seed = existing?.params || {};
    
    // Use the meal engine to generate new plan with same parameters
    const planParams = {
      userId,
      mealStructure: seed.mealStructure || { 
        breakfasts: 1, 
        lunches: 1, 
        dinners: 1, 
        snacks: 0,
        days: 7
      },
      tempDietPreference: seed.tempDietPreference,
      tempMedicalOverride: seed.tempMedicalOverride,
      generateImages: true,
      allowDuplicates: false,
    };
    
    // For now, generate a simple response structure
    // TODO: Integrate with proper meal engine plan generation
    const plan = {
      meals: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0
    };
    
    await upsertWeeklyPlan(userId, plan, {
      ...seed,
      regeneratedAt: new Date().toISOString(),
    });
    
    res.json({ plan });
  } catch (error) {
    console.error("Error regenerating weekly plan:", error);
    res.status(500).json({ error: "Failed to regenerate weekly plan" });
  }
});

// Delete weekly plan
router.post("/meal-plan/delete", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    
    await deleteWeeklyPlan(userId);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting weekly plan:", error);
    res.status(500).json({ error: "Failed to delete weekly plan" });
  }
});

// Check if user's plan is expired and needs regeneration
router.get("/meal-plan/status", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId required" });
    
    const status = await checkPlanExpiry(userId);
    res.json(status);
  } catch (error) {
    console.error("Error checking plan status:", error);
    res.status(500).json({ error: "Failed to check plan status" });
  }
});

// Generate immediate plan for new user (called after onboarding)
router.post("/meal-plan/immediate", async (req, res) => {
  try {
    const { userId, onboardingData } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    
    const planDetails = await generateImmediatePlan(userId, onboardingData || {});
    
    // For now, create a basic plan structure that will be enhanced
    // TODO: Integrate with actual meal generation service
    const mockPlan = {
      meals: [
        { id: '1', name: 'Welcome Breakfast', description: 'Your first meal to start the journey', nutrition: { calories: 350, protein_g: 20, carbs_g: 45, fat_g: 12 }, ingredients: [{ item: 'eggs', amount: 2, unit: 'whole' }], instructions: ['Cook and enjoy'], servings: 1, compliance: { allergiesCleared: true, medicalCleared: true, unitsStandardized: true } },
        { id: '2', name: 'Welcome Lunch', description: 'A nutritious midday meal', nutrition: { calories: 450, protein_g: 25, carbs_g: 50, fat_g: 15 }, ingredients: [{ item: 'chicken', amount: 4, unit: 'oz' }], instructions: ['Prepare and serve'], servings: 1, compliance: { allergiesCleared: true, medicalCleared: true, unitsStandardized: true } },
        { id: '3', name: 'Welcome Dinner', description: 'A satisfying evening meal', nutrition: { calories: 500, protein_g: 30, carbs_g: 40, fat_g: 20 }, ingredients: [{ item: 'salmon', amount: 6, unit: 'oz' }], instructions: ['Cook to perfection'], servings: 1, compliance: { allergiesCleared: true, medicalCleared: true, unitsStandardized: true } }
      ]
    };
    
    await upsertWeeklyPlan(userId, mockPlan, planDetails.params, planDetails.startDate, planDetails.endDate);
    
    res.json({ 
      ok: true, 
      plan: mockPlan, 
      startDate: planDetails.startDate, 
      endDate: planDetails.endDate 
    });
  } catch (error) {
    console.error("Error generating immediate plan:", error);
    res.status(500).json({ error: "Failed to generate immediate plan" });
  }
});

export default router;