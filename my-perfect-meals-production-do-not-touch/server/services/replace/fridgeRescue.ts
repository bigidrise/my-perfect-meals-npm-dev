import { db } from "../../db";
import { pantryItems } from "../../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { defaultRules, fitsBaseSafety } from "../rulesEngine";

const norm = (s: string) => s.trim().toLowerCase();

export async function pickFromPantry(
  userId: string, 
  wantedType: "breakfast" | "lunch" | "dinner" | "snack", 
  params: any = {}
) {
  // Get user's pantry items
  const pantry = (await db.select().from(pantryItems).where(eq(pantryItems.userId, userId)))
    .map(p => norm(p.name));

  // Get meal templates from database
  let templates: any[] = [];
  try {
    const result = await db.execute(sql`
      SELECT id, slug, name, type, calories, protein, carbs, fat, fiber, vegetables,
             diet_tags as "dietTags", badges, allergens, ingredients, steps, 
             prep_time as "prepTime", cook_time as "cookTime", servings, 
             image_url as "imageUrl", description, cuisine, difficulty
      FROM meal_templates 
      WHERE is_active = true AND type = ${wantedType}
    `);
    
    templates = (result.rows as any[]).map((t: any) => ({
      ...t,
      dietTags: Array.isArray(t.dietTags) ? t.dietTags : (typeof t.dietTags === 'string' ? JSON.parse(t.dietTags || '[]') : []),
      badges: Array.isArray(t.badges) ? t.badges : (typeof t.badges === 'string' ? JSON.parse(t.badges || '[]') : []),
      allergens: Array.isArray(t.allergens) ? t.allergens : (typeof t.allergens === 'string' ? JSON.parse(t.allergens || '[]') : []),
      ingredients: Array.isArray(t.ingredients) ? t.ingredients : (typeof t.ingredients === 'string' ? JSON.parse(t.ingredients || '[]') : []),
      steps: Array.isArray(t.steps) ? t.steps : (typeof t.steps === 'string' ? JSON.parse(t.steps || '[]') : [])
    }));
  } catch (error) {
    console.log("meal_templates table not available, using fallback");
    // Return a fallback meal with proper imageUrl
    const fallbackMeals = {
      breakfast: { slug: "avocado-toast", name: "Avocado Toast with Egg", calories: 380, protein: 20, carbs: 28, fat: 22 },
      lunch: { slug: "turkey-wrap", name: "Turkey and Veggie Wrap", calories: 410, protein: 30, carbs: 35, fat: 16 },
      dinner: { slug: "herb-salmon", name: "Herb-Crusted Salmon with Vegetables", calories: 485, protein: 38, carbs: 22, fat: 26 },
      snack: { slug: "apple-peanut-butter", name: "Apple Slices with Peanut Butter", calories: 160, protein: 6, carbs: 18, fat: 8 }
    };
    
    const fallback = fallbackMeals[wantedType];
    return {
      id: `fridge-${wantedType}-${Date.now()}`,
      slug: fallback.slug,
      name: fallback.name,
      type: wantedType,
      calories: fallback.calories,
      protein: fallback.protein,
      carbs: fallback.carbs,
      fat: fallback.fat,
      fiber: 5,
      vegetables: 1.5,
      imageUrl: `/meal-images/${fallback.slug}.jpg`,
      dietTags: ["balanced"],
      badges: ["fridge-rescue"],
      allergens: [],
      ingredients: [],
      steps: [],
      prepTime: 8,
      cookTime: 12,
      servings: 1,
      difficulty: "easy"
    };
  }

  // Filter by safety rules
  const safe = templates.filter(t => fitsBaseSafety(t, params, defaultRules));

  // Score by pantry overlap
  const scored = safe.map(t => {
    const names = new Set((t.ingredients || []).map((i: any) => norm(i.name)));
    const overlap = pantry.filter(i => names.has(i)).length;
    
    // Prefer simpler & faster meals too
    const simpleBonus = Math.max(0, 8 - (t.ingredients || []).length);
    const timeBonus = Math.max(0, 45 - ((t.prepTime || 0) + (t.cookTime || 0))) / 10;
    
    return { 
      t, 
      score: overlap * 3 + simpleBonus * 0.5 + timeBonus 
    };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.t || safe[0] || templates[0] || null;
}