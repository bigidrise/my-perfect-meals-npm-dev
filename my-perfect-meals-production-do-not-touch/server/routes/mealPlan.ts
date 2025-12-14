import { Router } from "express";
import { db } from "../db";
import { mealPlans, shoppingListItems, mealPlansCurrent } from "../../shared/schema";
import { and, eq, desc } from "drizzle-orm";
import { extractIngredients, mergeIngredients } from "../services/ingredients";

const r = Router();

function weekStartOf(dateIso?: string) {
  const d = dateIso ? new Date(dateIso) : new Date();
  // Get Monday of the current week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// GET current week's stored plan (or 404 if none)
r.get("/current", async (req, res) => {
  try {
    const userId = String(req.query.userId || "1");
    const row = (await db.select().from(mealPlans)
      .where(and(eq(mealPlans.userId, parseInt(userId)), eq(mealPlans.isActive, true)))).at(0);
    if (!row) return res.status(404).json({ message: "No active plan found." });
    res.json({ plan: row });
  } catch (error) {
    console.error("Error fetching current meal plan:", error);
    res.status(500).json({ error: "Failed to fetch meal plan" });
  }
});

// GET list of meal plans available (most recent first)
r.get("/all", async (req, res) => {
  try {
    const userId = String(req.query.userId || "1");
    const rows = await db.select().from(mealPlans)
      .where(eq(mealPlans.userId, parseInt(userId)))
      .orderBy(desc(mealPlans.generatedAt));
    res.json({ plans: rows.map(r => ({ 
      id: r.id, 
      name: r.name, 
      type: r.type, 
      isActive: r.isActive,
      generatedAt: r.generatedAt 
    })) });
  } catch (error) {
    console.error("Error fetching meal plans:", error);
    res.status(500).json({ error: "Failed to fetch meal plans" });
  }
});

// GET a specific meal plan
r.get("/:planId", async (req, res) => {
  try {
    const userId = String(req.query.userId || "1");
    const planId = parseInt(req.params.planId);
    const row = (await db.select().from(mealPlans)
      .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, parseInt(userId))))).at(0);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json({ plan: row });
  } catch (error) {
    console.error("Error fetching meal plan:", error);
    res.status(500).json({ error: "Failed to fetch meal plan" });
  }
});

// POST save a generated plan
r.post("/save", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "1");
    const { name, type, weeklyPlan, totalDailyCalories, totalDailyProtein, totalDailyCarbs, totalDailyFat } = req.body;
    
    if (!weeklyPlan) return res.status(400).json({ error: "weeklyPlan required" });

    const row = (await db.insert(mealPlans)
      .values({ 
        userId: parseInt(userId), 
        name: name || "My Meal Plan",
        type: type || "maintenance",
        weeklyPlan,
        totalDailyCalories,
        totalDailyProtein, 
        totalDailyCarbs,
        totalDailyFat,
        isActive: false
      })
      .returning()).at(0);
    res.json({ plan: row });
  } catch (error) {
    console.error("Error saving meal plan:", error);
    res.status(500).json({ error: "Failed to save meal plan" });
  }
});

// DELETE a specific meal plan
r.delete("/:planId", async (req, res) => {
  try {
    const userId = String(req.query.userId || "1");
    const planId = parseInt(req.params.planId);
    await db.delete(mealPlans)
      .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, parseInt(userId))));
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting meal plan:", error);
    res.status(500).json({ error: "Failed to delete meal plan" });
  }
});

// PUT activate a meal plan
r.put("/:planId/activate", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "1");
    const planId = parseInt(req.params.planId);
    
    // Deactivate all existing plans
    await db.update(mealPlans)
      .set({ isActive: false })
      .where(eq(mealPlans.userId, parseInt(userId)));
    
    // Activate the selected plan
    const row = (await db.update(mealPlans)
      .set({ isActive: true })
      .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, parseInt(userId))))
      .returning()).at(0);
    
    res.json({ plan: row });
  } catch (error) {
    console.error("Error activating meal plan:", error);
    res.status(500).json({ error: "Failed to activate meal plan" });
  }
});

// POST add a meal plan's ingredients to shopping list
r.post("/:planId/add-to-shopping-list", async (req, res) => {
  try {
    const userId = String(req.body?.userId || req.query.userId || "1");
    const planId = parseInt(req.params.planId);

    const row = (await db.select().from(mealPlans)
      .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, parseInt(userId))))).at(0);
    if (!row) return res.status(404).json({ error: "Meal plan not found." });

    const raw = extractIngredients(row.weeklyPlan);
    if (!raw.length) return res.json({ added: 0, message: "No ingredients to add." });

    const merged = mergeIngredients(raw);

    // Bulk insert with proper category mapping
    const values = merged.map(m => ({
      userId,
      name: m.name,
      normalized: m.name.toLowerCase().trim(),
      category: m.aisle || "Other",
      quantity: String(m.qty ?? 1),
      unit: m.unit || "",
      notes: m.notes || null,
      purchased: false,
    }));

    const inserted = await db.insert(shoppingListItems).values(values).returning();

    res.json({ added: inserted.length, items: inserted });
  } catch (error) {
    console.error("Error adding ingredients to shopping list:", error);
    res.status(500).json({ error: "Failed to add ingredients to shopping list" });
  }
});

export default r;