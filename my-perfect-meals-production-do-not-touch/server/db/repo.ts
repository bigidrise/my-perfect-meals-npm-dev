import { db } from "../db";
import { users, meals, mealIngredients, mealInstructions } from "../../shared/schema";
import { eq, and, inArray, asc } from "drizzle-orm";

export async function getOrCreateUser(email: string, name?: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return existing[0];
  const [u] = await db.insert(users).values({ 
    email, 
    username: email.split('@')[0], 
    password: 'temp', 
    firstName: name 
  }).returning();
  return u;
}

export async function getProfile(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] || null;
}

export async function upsertProfile(userId: string, data: any) {
  const current = await getProfile(userId);
  if (current) {
    await db.update(users).set(data).where(eq(users.id, userId));
  } else {
    await db.insert(users).values({ id: userId, username: userId, email: `${userId}@temp.com`, password: 'temp', ...data });
  }
}

export async function saveMeal(userId: string, meal: {
  name: string;
  description?: string;
  servings: number;
  imageUrl?: string;
  source: string;
  nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g?: number; sugar_g?: number };
  ingredients: Array<{ item: string; amount: number; unit: string; notes?: string }>;
  instructions: string[];
  compliance: { allergiesCleared: boolean; medicalCleared: boolean; unitsStandardized: boolean };
}) {
  const [m] = await db.insert(meals).values({
    userId,
    name: meal.name,
    description: meal.description,
    servings: meal.servings,
    imageUrl: meal.imageUrl,
    source: meal.source,
    calories: meal.nutrition.calories,
    proteinG: meal.nutrition.protein_g,
    carbsG: meal.nutrition.carbs_g,
    fatG: meal.nutrition.fat_g,
    fiberG: meal.nutrition.fiber_g ?? null,
    sugarG: meal.nutrition.sugar_g ?? null,
    compliance: meal.compliance,
  }).returning();

  if (!m) throw new Error("Failed to insert meal");

  if (meal.ingredients.length) {
    await db.insert(mealIngredients).values(
      meal.ingredients.map(i => ({
        mealId: m.id,
        item: i.item,
        amount: String(i.amount),
        unit: i.unit,
        notes: i.notes ?? null,
      }))
    );
  }

  if (meal.instructions.length) {
    await db.insert(mealInstructions).values(
      meal.instructions.map((s, idx) => ({
        mealId: m.id,
        stepNumber: idx + 1,
        step: s,
      }))
    );
  }

  return m;
}

// Shopping list functions removed - all shopping functionality removed

// All shopping list functions removed - shopping functionality completely eliminated

// Shopping list grouping function removed

// All shopping-related functions removed - aisle rules, stores, store aisles, item rules, grouping functions all eliminated