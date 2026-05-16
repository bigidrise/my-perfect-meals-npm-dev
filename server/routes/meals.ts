// --- NEW: server/routes/meals.ts ---
import express from "express";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import { users, mealInstances, userRecipes } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";
import { generateMealImageUnified, type ImageSourceType } from "../services/mealImageGenerator";

const router = express.Router();

// ─────────────────────────────────────────────
// Shared image generation endpoint (non-blocking, called in parallel by client)
// Used by ALL AI meal generators after text is returned.
// Routes through the 4-layer system: memory cache → DB cache → S3 → DALL-E.
// Cache hits are instant; new images are persisted so they never regenerate.
// ─────────────────────────────────────────────
router.post("/generate-image", async (req: any, res) => {
  const { mealName, mealType = "dinner", ingredients } = req.body || {};

  if (!mealName || mealName.trim().length < 3) {
    return res.status(400).json({ imageUrl: null });
  }

  // Resolve sourceType from mealType so the 4-layer prompt builder
  // uses the correct visual directive (beverage, snack, dessert, meal).
  const mealTypeLower = (mealType || "").toLowerCase();
  const nameLower = mealName.toLowerCase();

  let sourceType: ImageSourceType = "meal";
  if (mealTypeLower === "beverages" || mealTypeLower === "beverage" || mealTypeLower === "drink" ||
      /smoothie|shake|juice|latte|coffee|tea|cocktail|mocktail|drink|beverage|lemonade/.test(nameLower)) {
    sourceType = "beverage";
  } else if (mealTypeLower === "snack" || mealTypeLower === "snacks") {
    sourceType = "snack";
  } else if (mealTypeLower === "dessert" || mealTypeLower === "desserts" ||
      /cake|pie|cookie|brownie|pudding|ice cream|cheesecake|tart|mousse|cupcake/.test(nameLower)) {
    sourceType = "dessert";
  }

  try {
    const imageUrl = await generateMealImageUnified(mealName.trim(), ingredients || [], sourceType);
    return res.json({ imageUrl });
  } catch (err: any) {
    console.error(`[generate-image] failed for "${mealName}":`, err.message);
    return res.json({ imageUrl: null });
  }
});

// Utility to recalculate daily nutrition (mock implementation)
const recalcDailyNutrition = async (userId: string, date?: Date) => {
  // TODO: Implement actual nutrition calculation
  console.log(`Recalculating daily nutrition for user ${userId}`);
};

// POST /api/meals/:mealInstanceId/log - Log a meal as eaten
router.post('/:mealInstanceId/log', requireAuth, async (req: any, res) => {
  try {
    const { mealInstanceId } = req.params;
    const { recipeId, recipePayload, note } = req.body;
    const userId = getAuthUserId(req);

    let finalRecipeId = recipeId;
    if (!finalRecipeId && recipePayload) {
      const [saved] = await db.insert(userRecipes).values({ 
        userId, 
        ...recipePayload 
      }).returning({ id: userRecipes.id });
      finalRecipeId = saved.id;
    }

    await db.update(mealInstances)
      .set({ 
        status: 'eaten', 
        loggedAt: sql`now()`, 
        recipeId: finalRecipeId, 
        notes: note || null 
      })
      .where(and(
        eq(mealInstances.id, mealInstanceId), 
        eq(mealInstances.userId, userId)
      ));

    await recalcDailyNutrition(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error logging meal:", error);
    res.status(500).json({ error: "Failed to log meal" });
  }
});

// POST /api/meals/:mealInstanceId/skip - Skip a meal
router.post('/:mealInstanceId/skip', requireAuth, async (req: any, res) => {
  try {
    const { mealInstanceId } = req.params;
    const userId = getAuthUserId(req);

    await db.update(mealInstances)
      .set({ status: 'skipped' })
      .where(and(
        eq(mealInstances.id, mealInstanceId), 
        eq(mealInstances.userId, userId)
      ));

    await recalcDailyNutrition(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error skipping meal:", error);
    res.status(500).json({ error: "Failed to skip meal" });
  }
});

// POST /api/meals/:mealInstanceId/replace-and-optional-log - Replace meal and optionally log it
router.post('/:mealInstanceId/replace-and-optional-log', requireAuth, async (req: any, res) => {
  try {
    const { mealInstanceId } = req.params;
    const { recipeId, recipePayload, logNow, source, note } = req.body;
    const userId = getAuthUserId(req);

    // 1) Load original meal instance
    const [orig] = await db.select().from(mealInstances)
      .where(and(
        eq(mealInstances.id, mealInstanceId), 
        eq(mealInstances.userId, userId)
      ));

    if (!orig) {
      return res.status(404).json({ error: 'Meal instance not found' });
    }

    // 2) Ensure recipe exists
    let finalRecipeId = recipeId;
    if (!finalRecipeId && recipePayload) {
      const [saved] = await db.insert(userRecipes).values({ 
        userId, 
        ...recipePayload 
      }).returning({ id: userRecipes.id });
      finalRecipeId = saved.id;
    }

    // 3) Create the replacement meal instance
    const [replacement] = await db.insert(mealInstances).values({
      userId,
      date: orig.date,
      slot: orig.slot,
      recipeId: finalRecipeId,
      source,
      status: logNow ? 'eaten' : 'planned',
      loggedAt: logNow ? sql`now()` : null,
      notes: note || null,
    }).returning();

    // 4) Mark original as replaced
    await db.update(mealInstances)
      .set({ 
        status: 'replaced', 
        replacedByMealInstanceId: replacement.id 
      })
      .where(eq(mealInstances.id, orig.id));

    // 5) Recalculate nutrition
    await recalcDailyNutrition(userId);

    res.json(replacement);
  } catch (error) {
    console.error("Error replacing meal:", error);
    res.status(500).json({ error: "Failed to replace meal" });
  }
});

// GET /api/meals/instances/:date - Get meal instances for a specific date
router.get('/instances/:date', requireAuth, async (req: any, res) => {
  try {
    const { date } = req.params;
    const userId = getAuthUserId(req);

    const instances = await db.select()
      .from(mealInstances)
      .where(and(
        eq(mealInstances.userId, userId),
        eq(mealInstances.date, date)
      ))
      .orderBy(mealInstances.slot);

    res.json(instances);
  } catch (error) {
    console.error("Error fetching meal instances:", error);
    res.status(500).json({ error: "Failed to fetch meal instances" });
  }
});

// POST /api/meals/create-and-log - Create new meal instance and log it
router.post('/create-and-log', requireAuth, async (req: any, res) => {
  try {
    const { date, slot, recipePayload, source } = req.body;
    const userId = getAuthUserId(req);

    let recipeId = null;
    if (recipePayload) {
      const [saved] = await db.insert(userRecipes).values({
        userId,
        title: recipePayload.title,
        ingredients: recipePayload.ingredients,
        instructions: recipePayload.instructions,
        nutrition: recipePayload.nutrition
      }).returning({ id: userRecipes.id });
      recipeId = saved.id;
    }

    await db.insert(mealInstances).values({
      userId,
      date,
      slot,
      recipeId,
      source,
      status: 'eaten',
      loggedAt: sql`now()`
    });

    // Recalculate daily nutrition
    await recalcDailyNutrition(userId);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error in /create-and-log:', error);
    res.status(500).json({ error: 'Failed to create and log meal' });
  }
});

// POST /api/meals/add-to-plan - Add meal to plan without logging
router.post('/add-to-plan', requireAuth, async (req: any, res) => {
  try {
    const { date, slot, recipePayload, source } = req.body;
    const userId = getAuthUserId(req);

    let recipeId = null;
    if (recipePayload) {
      const [saved] = await db.insert(userRecipes).values({
        userId,
        title: recipePayload.title,
        ingredients: recipePayload.ingredients,
        instructions: recipePayload.instructions,
        nutrition: recipePayload.nutrition
      }).returning({ id: userRecipes.id });
      recipeId = saved.id;
    }

    const [row] = await db.insert(mealInstances).values({
      userId,
      date,
      slot,
      recipeId,
      source,
      status: 'planned'
    }).returning();

    res.json(row);
  } catch (error) {
    console.error('Error in /add-to-plan:', error);
    res.status(500).json({ error: 'Failed to add meal to plan' });
  }
});

// Replace functionality for weekly meal plans
router.post('/replace/fridge', requireAuth, async (req: any, res) => {
  try {
    const userId = getAuthUserId(req);
    const { dayIndex, mealIndex, params } = req.body;
    
    const { getCurrentPlan, setCurrentPlan } = await import('../services/currentPlan');
    const { pickFromPantry } = await import('../services/replace/fridgeRescue');
    
    const cur = await getCurrentPlan(userId);
    if (!cur) return res.status(404).json({ error: "No current plan" });

    const day = (cur.plan as any)[0]?.days[dayIndex];
    if (!day) return res.status(400).json({ error: "Bad dayIndex" });
    
    const slot = day.meals[mealIndex];
    if (!slot) return res.status(400).json({ error: "Bad mealIndex" });

    const replacement = await pickFromPantry(userId, slot.type, params || {});
    if (!replacement) return res.status(404).json({ error: "No replacement found" });

    day.meals[mealIndex] = replacement;
    await setCurrentPlan(userId, cur.plan, cur.meta);
    
    res.json({ ok: true, plan: cur.plan, meta: cur.meta });
  } catch (e) {
    console.error("Fridge Rescue error:", e);
    res.status(500).json({ error: "Replace failed" });
  }
});

router.post('/replace/craving', requireAuth, async (req: any, res) => {
  try {
    const userId = getAuthUserId(req);
    const { dayIndex, mealIndex, want, params } = req.body;
    
    const { getCurrentPlan, setCurrentPlan } = await import('../services/currentPlan');
    const { pickFromCraving } = await import('../services/replace/cravingCreator');
    
    const cur = await getCurrentPlan(userId);
    if (!cur) return res.status(404).json({ error: "No current plan" });

    const day = (cur.plan as any)[0]?.days[dayIndex];
    const slot = day?.meals?.[mealIndex];
    if (!slot) return res.status(400).json({ error: "Bad indices" });

    const replacement = await pickFromCraving(want || "", slot.type, params || {});
    if (!replacement) return res.status(404).json({ error: "No replacement found" });

    day.meals[mealIndex] = replacement;
    await setCurrentPlan(userId, cur.plan, cur.meta);
    
    res.json({ ok: true, plan: cur.plan, meta: cur.meta });
  } catch (e) {
    console.error("Craving Creator error:", e);
    res.status(500).json({ error: "Replace failed" });
  }
});

router.post('/replace/library', requireAuth, async (req: any, res) => {
  try {
    const userId = getAuthUserId(req);
    const { dayIndex, mealIndex, templateId } = req.body;
    
    const { getCurrentPlan, setCurrentPlan } = await import('../services/currentPlan');
    
    const cur = await getCurrentPlan(userId);
    if (!cur) return res.status(404).json({ error: "No current plan" });

    const day = (cur.plan as any)[0]?.days[dayIndex];
    const slot = day?.meals?.[mealIndex];
    if (!slot) return res.status(400).json({ error: "Bad indices" });

    const result = await db.execute(sql`
      SELECT id, slug, name, type, calories, protein, carbs, fat, fiber, vegetables,
             diet_tags as "dietTags", badges, allergens, ingredients, steps, 
             prep_time as "prepTime", cook_time as "cookTime", servings, 
             image_url as "imageUrl", description, cuisine, difficulty
      FROM meal_templates 
      WHERE id = ${templateId} AND is_active = true
    `);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    const template = result.rows[0] as any;
    const replacement = {
      ...template,
      dietTags: Array.isArray(template.dietTags) ? template.dietTags : (typeof template.dietTags === 'string' ? JSON.parse(template.dietTags || '[]') : []),
      badges: Array.isArray(template.badges) ? template.badges : (typeof template.badges === 'string' ? JSON.parse(template.badges || '[]') : []),
      allergens: Array.isArray(template.allergens) ? template.allergens : (typeof template.allergens === 'string' ? JSON.parse(template.allergens || '[]') : []),
      ingredients: Array.isArray(template.ingredients) ? template.ingredients : (typeof template.ingredients === 'string' ? JSON.parse(template.ingredients || '[]') : []),
      steps: Array.isArray(template.steps) ? template.steps : (typeof template.steps === 'string' ? JSON.parse(template.steps || '[]') : [])
    };

    day.meals[mealIndex] = replacement;
    await setCurrentPlan(userId, cur.plan, cur.meta);
    
    res.json({ ok: true, plan: cur.plan, meta: cur.meta });
  } catch (e) {
    console.error("Library replacement error:", e);
    res.status(500).json({ error: "Replace failed" });
  }
});

// Custom meal replacement - accepts a complete meal object
router.post('/replace/custom', requireAuth, async (req: any, res) => {
  try {
    const userId = getAuthUserId(req);
    const { dayIndex, mealIndex, meal } = req.body;
    
    const { getCurrentPlan, setCurrentPlan } = await import('../services/currentPlan');
    
    const cur = await getCurrentPlan(userId);
    if (!cur) return res.status(404).json({ error: "No current plan" });

    const day = (cur.plan as any)[0]?.days[dayIndex];
    if (!day || !day.meals[mealIndex]) {
      return res.status(400).json({ error: "Invalid day or meal index" });
    }

    // Ensure the meal has an imageUrl if it has a slug
    const customMeal = {
      ...meal,
      imageUrl: meal.imageUrl || (meal.slug ? `/meal-images/${meal.slug}.jpg` : undefined)
    };

    day.meals[mealIndex] = customMeal;
    await setCurrentPlan(userId, cur.plan, cur.meta);
    
    res.json({ ok: true, plan: cur.plan, meta: cur.meta });
  } catch (e) {
    console.error("Custom replacement error:", e);
    res.status(500).json({ error: "Replace failed" });
  }
});

export default router;