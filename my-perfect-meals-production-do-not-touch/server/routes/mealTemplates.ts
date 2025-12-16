import { Router } from "express";
import { db } from "../db";
import { mealTemplates, mealTemplateIngredients, mealTemplateInstructions } from "../../shared/schema";
import { eq, asc, sql } from "drizzle-orm";

export const templateRouter = Router();

// Get specific meal template by ID
templateRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🍳 Fetching meal template for:", id);

    const [tpl] = await db.select().from(mealTemplates).where(eq(mealTemplates.id, id)).limit(1);
    if (!tpl) return res.status(404).json({ error: "Meal template not found" });

    const [ingredients, instructions] = await Promise.all([
      db.select().from(mealTemplateIngredients)
        .where(eq(mealTemplateIngredients.templateId, id))
        .orderBy(asc(mealTemplateIngredients.position)),
      db.select().from(mealTemplateInstructions)
        .where(eq(mealTemplateInstructions.templateId, id))
        .orderBy(asc(mealTemplateInstructions.stepNumber)),
    ]);

    console.log("✅ Found meal template:", tpl.name);
    return res.json({
      id: tpl.id,
      name: tpl.name,
      servings: tpl.servings,
      prepMinutes: tpl.prepMinutes,
      cookMinutes: tpl.cookMinutes,
      ingredients: ingredients.map(i => ({
        quantity: i.quantity,
        unit: i.unit,
        name: i.name,
        notes: i.notes ?? null,
      })),
      instructions: instructions.map(s => s.text),
    });
  } catch (e) {
    console.error("Error fetching meal template by ID:", e);
    return res.status(500).json({ error: "Internal error loading recipe" });
  }
});

// Get all meal templates (with filters)
templateRouter.get("/", async (req, res, next) => {
  try {
    const { type, cuisine, q, limit = 20 } = req.query as any;
    
    const result = await db.execute(sql`
      SELECT id, id as slug, name, category as type, 
             COALESCE(kcal, 400) as calories, 
             COALESCE(protein, 25) as protein, 
             COALESCE(carbs, 30) as carbs, 
             COALESCE(fat, 15) as fat, 
             5 as fiber, 2 as vegetables,
             COALESCE(tags, '{}') as "dietTags", 
             '[]' as badges, '[]' as allergens, '[]' as ingredients, '[]' as steps, 
             prep_minutes as "prepTime", cook_minutes as "cookTime", servings, 
             '' as "imageUrl", '' as description, '' as cuisine, 'easy' as difficulty
      FROM meal_templates 
      WHERE is_active = true AND category IS NOT NULL
      ${type ? sql` AND category = ${type}` : sql``}
      ${q ? sql` AND name ILIKE ${`%${q}%`}` : sql``}
      ORDER BY name
      LIMIT ${Number(limit)}
    `);
    
    const templates = (result.rows as any[]).map((t: any) => ({
      ...t,
      dietTags: Array.isArray(t.dietTags) ? t.dietTags : (typeof t.dietTags === 'string' ? JSON.parse(t.dietTags || '[]') : []),
      badges: Array.isArray(t.badges) ? t.badges : (typeof t.badges === 'string' ? JSON.parse(t.badges || '[]') : []),
      allergens: Array.isArray(t.allergens) ? t.allergens : (typeof t.allergens === 'string' ? JSON.parse(t.allergens || '[]') : []),
      ingredients: Array.isArray(t.ingredients) ? t.ingredients : (typeof t.ingredients === 'string' ? JSON.parse(t.ingredients || '[]') : []),
      steps: Array.isArray(t.steps) ? t.steps : (typeof t.steps === 'string' ? JSON.parse(t.steps || '[]') : [])
    }));
    
    res.json({ items: templates });
  } catch (e) {
    console.error("Error fetching meal templates:", e);
    res.status(500).json({ error: "Failed to fetch templates", items: [] });
  }
});