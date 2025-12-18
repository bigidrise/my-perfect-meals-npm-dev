import { Router } from "express";
import { db } from "../db";
import { weeklyMealPlans, mealPlansCurrent } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';
import { createMealRemindersForWeek } from "../services/mealReminder";
import { rescheduleSingleMealReminder } from "../services/mealReminderSingle";
import { weeklyMealPlanningServiceA } from "../services/weeklyMealPlanningServiceA";
import { weeklyMealPlanningServiceB } from "../services/weeklyMealPlanningServiceB";

const r = Router();


// Generate a new meal plan
r.post("/generate", async (req, res) => {
  try {
    const { 
      weeks = 1,
      mealsPerDay = 3, 
      snacksPerDay = 1, 
      targets = { calories: 2000, protein: 140 },
      scheduleTimes,
      planningMode = "TURBO",
      variant = "AUTO"
    } = req.body;

    const userId = req.body.userId || process.env.DEV_USER_ID || "00000000-0000-0000-0000-000000000001";

    // Determine which service to use (A/B testing)
    const chosen = variant === "AUTO" ? (Math.random() < 0.5 ? "A" : "B") : variant;
    const service = chosen === "A" ? weeklyMealPlanningServiceA : weeklyMealPlanningServiceB;

    // Generate the plan
    const result = await service.generate({
      weeks,
      mealsPerDay,
      snacksPerDay,
      targets,
      diet: "balanced", // Default, can be overridden
      medicalFlags: [],
      allergies: []
    });

    // Create meta object with planning mode and schedule info
    const meta = {
      ...result.meta,
      planningMode,
      variant: chosen,
      ...(scheduleTimes && { scheduleTimes })
    };

    // Store as current plan in mealPlansCurrent table
    await db
      .insert(mealPlansCurrent)
      .values({ 
        userId, 
        plan: result.plan, 
        meta, 
        updatedAt: new Date() 
      })
      .onConflictDoUpdate({
        target: mealPlansCurrent.userId,
        set: { 
          plan: result.plan, 
          meta, 
          updatedAt: new Date() 
        },
      });

    res.json({ 
      plan: result.plan, 
      meta 
    });
  } catch (error: any) {
    console.error("Error generating meal plan:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get current plan from mealPlansCurrent table
r.get("/current", async (req, res) => {
  try {
    const userId = req.query.userId as string || process.env.DEV_USER_ID || "00000000-0000-0000-0000-000000000001";

    const row = await db.select().from(mealPlansCurrent)
      .where(eq(mealPlansCurrent.userId, userId))
      .limit(1);

    if (row.length === 0) {
      return res.status(404).json({ error: "No current plan" });
    }

    res.json(row[0]);
  } catch (error: any) {
    console.error("Error fetching current meal plan:", error);
    res.status(500).json({ error: error.message });
  }
});

// Save a new meal plan (archives previous active plan)
r.post("/save", async (req, res) => {
  try {
    const { userId, planData, weekStartDate, weekEndDate, source = "ai_meal_creator" } = req.body;
    
    if (!userId || !planData || !weekStartDate || !weekEndDate) {
      return res.status(400).json({ 
        error: "userId, planData, weekStartDate, and weekEndDate are required" 
      });
    }

    // Archive any existing active meal plans for this user
    await db.update(weeklyMealPlans)
      .set({ isActive: 0 })
      .where(and(
        eq(weeklyMealPlans.userId, userId),
        eq(weeklyMealPlans.isActive, 1)
      ));

    // Count meals in the plan
    const mealCount = planData.meals ? planData.meals.length * 3 : 0; // breakfast, lunch, dinner per day

    // Save the new active meal plan
    const newMealPlan = {
      id: uuidv4(),
      userId,
      planData,
      weekStartDate,
      weekEndDate,
      mealCount,
      source,
      isActive: 1
    };

    await db.insert(weeklyMealPlans).values(newMealPlan);

    // Automatically schedule SMS meal reminders if user has consented
    try {
      const { createMealRemindersForWeek } = await import('../services/mealReminder');
      const result = await createMealRemindersForWeek({
        userId,
        weekStart: weekStartDate,
        planData: planData as any
      });
      console.log(`Auto-scheduled ${result.scheduled} meal reminders for new meal plan`);
    } catch (error) {
      console.error('Error auto-scheduling meal reminders:', error);
      // Don't fail the meal plan save if notifications fail
    }

    res.json({ success: true, mealPlan: newMealPlan });
  } catch (error: any) {
    console.error("Error saving meal plan:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get meal plan history for a user
r.get("/history", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const mealPlanHistory = await db.select()
      .from(weeklyMealPlans)
      .where(eq(weeklyMealPlans.userId, userId as string))
      .orderBy(desc(weeklyMealPlans.createdAt));

    res.json({ history: mealPlanHistory });
  } catch (error: any) {
    console.error("Error fetching meal plan history:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete/archive a meal plan
r.delete("/:planId", async (req, res) => {
  try {
    const { planId } = req.params;
    const { userId } = req.body;

    // Archive the meal plan (don't actually delete)
    await db.update(weeklyMealPlans)
      .set({ isActive: 0 })
      .where(and(
        eq(weeklyMealPlans.id, planId),
        eq(weeklyMealPlans.userId, userId)
      ));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error archiving meal plan:", error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule SMS reminders for a meal plan
r.post("/:planId/schedule-reminders", async (req, res) => {
  try {
    const { planId } = req.params;
    const { userId } = req.body;

    // Get the meal plan
    const mealPlan = await db.select()
      .from(weeklyMealPlans)
      .where(and(
        eq(weeklyMealPlans.id, planId),
        eq(weeklyMealPlans.userId, userId)
      ))
      .limit(1);

    if (mealPlan.length === 0) {
      return res.status(404).json({ error: "Meal plan not found" });
    }

    const plan = mealPlan[0];
    const result = await createMealRemindersForWeek({
      userId,
      weekStart: plan.weekStartDate,
      planData: plan.planData
    });

    res.json({ success: true, scheduled: result.scheduled });
  } catch (error: any) {
    console.error("Error scheduling meal reminders:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update individual meal time and reschedule SMS
r.patch("/:planId/meals/:mealId", async (req, res) => {
  try {
    const { planId, mealId } = req.params;
    const { userId, date, time, title, summary } = req.body;

    if (!userId || !date || !time) {
      return res.status(400).json({ 
        error: "userId, date, and time are required" 
      });
    }

    // Get the meal plan to update
    const mealPlan = await db.select()
      .from(weeklyMealPlans)
      .where(and(
        eq(weeklyMealPlans.id, planId),
        eq(weeklyMealPlans.userId, userId)
      ))
      .limit(1);

    if (mealPlan.length === 0) {
      return res.status(404).json({ error: "Meal plan not found" });
    }

    const plan = mealPlan[0];
    
    // Update the meal time in the plan data
    const updatedPlanData = plan.planData ? { ...plan.planData } : {};
    if (updatedPlanData.days) {
      for (const day of updatedPlanData.days) {
        if (day.date === date && day.meals) {
          const meal = day.meals.find((m: any) => m.id === mealId);
          if (meal) {
            meal.time = time;
            if (title) meal.name = title;
            break;
          }
        }
      }
    }

    // Update the meal plan in the database
    await db.update(weeklyMealPlans)
      .set({ planData: updatedPlanData })
      .where(eq(weeklyMealPlans.id, planId));

    // Reschedule the SMS reminder for this specific meal
    const reminderResult = await rescheduleSingleMealReminder({
      userId,
      weekStart: plan.weekStartDate,
      mealId,
      date,
      time,
      title,
      summary
    });

    res.json({ 
      success: true, 
      reminderScheduled: reminderResult.scheduled,
      updatedPlan: updatedPlanData 
    });
  } catch (error: any) {
    console.error("Error updating meal time:", error);
    res.status(500).json({ error: error.message });
  }
});

export default r;