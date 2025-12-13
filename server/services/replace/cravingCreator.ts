import { db } from "../../db";
import { sql } from "drizzle-orm";
import { defaultRules, fitsBaseSafety } from "../rulesEngine";

// Simple cuisine/keyword mapping for cravings
const MAPPING = [
  { key: /mex|tex/i, tags: ["mexican", "tex-mex"] },
  { key: /ital|pasta|marinara/i, tags: ["italian"] },
  { key: /asian|teriyaki|soy|sesame|stir/i, tags: ["asian"] },
  { key: /medit|greek|feta|olive/i, tags: ["mediterranean"] },
  { key: /indian|curry|garam|masala/i, tags: ["indian"] },
  { key: /bbq|smok/i, tags: ["bbq", "american"] },
];

export async function pickFromCraving(
  want: string, 
  wantedType: "breakfast" | "lunch" | "dinner" | "snack", 
  params: any = {}
) {
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
      breakfast: { slug: "protein-oats", name: "Protein Overnight Oats", calories: 340, protein: 28, carbs: 35, fat: 8 },
      lunch: { slug: "quinoa-bowl", name: "Mediterranean Quinoa Bowl", calories: 420, protein: 32, carbs: 48, fat: 12 },
      dinner: { slug: "chicken-stirfry", name: "Chicken and Vegetable Stir-Fry", calories: 450, protein: 36, carbs: 28, fat: 18 },
      snack: { slug: "greek-yogurt-nuts", name: "Greek Yogurt with Nuts", calories: 180, protein: 15, carbs: 12, fat: 8 }
    };
    
    const fallback = fallbackMeals[wantedType];
    return {
      id: `craving-${wantedType}-${Date.now()}`,
      slug: fallback.slug,
      name: fallback.name,
      type: wantedType,
      calories: fallback.calories,
      protein: fallback.protein,
      carbs: fallback.carbs,
      fat: fallback.fat,
      fiber: 4,
      vegetables: 1,
      imageUrl: `/meal-images/${fallback.slug}.jpg`,
      dietTags: ["balanced"],
      badges: ["craving"],
      allergens: [],
      ingredients: [],
      steps: [],
      prepTime: 10,
      cookTime: 15,
      servings: 1,
      difficulty: "easy"
    };
  }

  // Find matching cuisine tags
  const matches = MAPPING.find(m => m.key.test(want))?.tags || [];

  // Filter by safety rules
  const safe = templates.filter(t => fitsBaseSafety(t, params, defaultRules));

  // Score by craving match
  const scored = safe.map(t => {
    const cuisineHit = matches.includes((t.cuisine || "").toLowerCase()) ? 3 : 0;
    const nameHit = new RegExp(want, "i").test(t.name) ? 2 : 0;
    const diffBonus = (t.difficulty === "easy" ? 1 : 0);
    
    return { 
      t, 
      score: cuisineHit + nameHit + diffBonus 
    };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.t || safe[0] || templates[0] || null;
}