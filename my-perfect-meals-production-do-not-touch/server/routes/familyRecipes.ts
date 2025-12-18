// Family Recipes API Routes
import { Router } from "express";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { 
  familyRecipes, 
  familyRecipeIngredients, 
  familyRecipeSteps, 
  familyRecipeNutrition 
} from "../../shared/schema";
import { computeNutritionAndBadges, scaleIngredients } from "../services/familyNutrition";

export const familyRecipesRouter = Router();

// Helper: get user ID from request
function getUserId(req: any): string | null {
  return req.user?.id || req.user?.claims?.sub || req.headers["x-user-id"] || "00000000-0000-0000-0000-000000000001";
}

// Create new family recipe
familyRecipesRouter.post("/family-recipes", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { 
      title, 
      story, 
      servings = 4, 
      ingredients = [], 
      steps = [], 
      dietaryTags = [], 
      allergens = [], 
      imageUrl 
    } = req.body;

    if (!title || !ingredients.length || !steps.length) {
      return res.status(400).json({ 
        error: "Title, ingredients, and steps are required" 
      });
    }

    // Create recipe
    const [recipe] = await db.insert(familyRecipes).values({
      userId,
      title,
      story,
      servings,
      imageUrl,
      dietaryTags,
      allergens
    }).returning();

    // Insert ingredients
    if (ingredients.length) {
      await db.insert(familyRecipeIngredients).values(
        ingredients.map((ing: any, i: number) => ({
          recipeId: recipe.id,
          qty: String(Number(ing.qty) || 0),
          unit: String(ing.unit || ""),
          item: String(ing.item || ""),
          notes: ing.notes || null,
          sortIdx: i
        }))
      );
    }

    // Insert steps
    if (steps.length) {
      await db.insert(familyRecipeSteps).values(
        steps.map((step: any, i: number) => ({
          recipeId: recipe.id,
          text: String(step.text || ""),
          sortIdx: i
        }))
      );
    }

    // Compute and store nutrition
    const nutrition = await computeNutritionAndBadges(ingredients, servings);
    await db.insert(familyRecipeNutrition).values({
      recipeId: recipe.id,
      calories: nutrition.calories,
      protein: String(nutrition.protein),
      carbs: String(nutrition.carbs),
      fat: String(nutrition.fat),
      fiber: String(nutrition.fiber),
      sodium: String(nutrition.sodium),
      badges: nutrition.badges
    });

    res.json({ id: recipe.id, success: true });
  } catch (error: any) {
    console.error("Error creating family recipe:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

// Get all user's family recipes
familyRecipesRouter.get("/family-recipes", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const recipes = await db
      .select()
      .from(familyRecipes)
      .where(eq(familyRecipes.userId, userId))
      .orderBy(familyRecipes.createdAt);

    res.json(recipes);
  } catch (error: any) {
    console.error("Error fetching family recipes:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get single family recipe with full details
familyRecipesRouter.get("/family-recipes/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id;

    const [recipe] = await db
      .select()
      .from(familyRecipes)
      .where(and(
        eq(familyRecipes.id, id),
        eq(familyRecipes.userId, userId)
      ));

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const ingredients = await db
      .select()
      .from(familyRecipeIngredients)
      .where(eq(familyRecipeIngredients.recipeId, id))
      .orderBy(familyRecipeIngredients.sortIdx);

    const steps = await db
      .select()
      .from(familyRecipeSteps)
      .where(eq(familyRecipeSteps.recipeId, id))
      .orderBy(familyRecipeSteps.sortIdx);

    const [nutrition] = await db
      .select()
      .from(familyRecipeNutrition)
      .where(eq(familyRecipeNutrition.recipeId, id));

    res.json({
      ...recipe,
      ingredients,
      steps,
      nutrition: nutrition || null
    });
  } catch (error: any) {
    console.error("Error fetching family recipe:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update family recipe
familyRecipesRouter.put("/family-recipes/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id;
    const { 
      title, 
      story, 
      servings, 
      ingredients = [], 
      steps = [], 
      dietaryTags = [], 
      allergens = [], 
      imageUrl 
    } = req.body;

    // Update recipe
    await db
      .update(familyRecipes)
      .set({
        title,
        story,
        servings,
        dietaryTags,
        allergens,
        imageUrl,
        updatedAt: new Date()
      })
      .where(and(
        eq(familyRecipes.id, id),
        eq(familyRecipes.userId, userId)
      ));

    // Replace ingredients and steps
    await db.delete(familyRecipeIngredients).where(eq(familyRecipeIngredients.recipeId, id));
    await db.delete(familyRecipeSteps).where(eq(familyRecipeSteps.recipeId, id));

    if (ingredients.length) {
      await db.insert(familyRecipeIngredients).values(
        ingredients.map((ing: any, i: number) => ({
          recipeId: id,
          qty: String(Number(ing.qty) || 0),
          unit: String(ing.unit || ""),
          item: String(ing.item || ""),
          notes: ing.notes || null,
          sortIdx: i
        }))
      );
    }

    if (steps.length) {
      await db.insert(familyRecipeSteps).values(
        steps.map((step: any, i: number) => ({
          recipeId: id,
          text: String(step.text || ""),
          sortIdx: i
        }))
      );
    }

    // Recompute nutrition
    const nutrition = await computeNutritionAndBadges(ingredients, servings || 4);
    await db.insert(familyRecipeNutrition).values({
      recipeId: id,
      calories: nutrition.calories,
      protein: String(nutrition.protein),
      carbs: String(nutrition.carbs),
      fat: String(nutrition.fat),
      fiber: String(nutrition.fiber),
      sodium: String(nutrition.sodium),
      badges: nutrition.badges
    }).onConflictDoUpdate({
      target: familyRecipeNutrition.recipeId,
      set: {
        calories: nutrition.calories,
        protein: String(nutrition.protein),
        carbs: String(nutrition.carbs),
        fat: String(nutrition.fat),
        fiber: String(nutrition.fiber),
        sodium: String(nutrition.sodium),
        badges: nutrition.badges
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating family recipe:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete family recipe
familyRecipesRouter.delete("/family-recipes/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id;

    await db
      .delete(familyRecipes)
      .where(and(
        eq(familyRecipes.id, id),
        eq(familyRecipes.userId, userId)
      ));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting family recipe:", error);
    res.status(500).json({ error: error.message });
  }
});

// Scale recipe ingredients
familyRecipesRouter.post("/family-recipes/:id/scale", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id;
    const { servingsTarget } = req.body;

    if (!servingsTarget || servingsTarget <= 0) {
      return res.status(400).json({ error: "Valid servingsTarget required" });
    }

    const [recipe] = await db
      .select()
      .from(familyRecipes)
      .where(and(
        eq(familyRecipes.id, id),
        eq(familyRecipes.userId, userId)
      ));

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const ingredients = await db
      .select()
      .from(familyRecipeIngredients)
      .where(eq(familyRecipeIngredients.recipeId, id))
      .orderBy(familyRecipeIngredients.sortIdx);

    const scaledIngredients = scaleIngredients(
      ingredients.map(ing => ({
        qty: Number(ing.qty),
        unit: ing.unit,
        item: ing.item,
        notes: ing.notes || undefined
      })),
      recipe.servings,
      servingsTarget
    );

    res.json({
      servingsFrom: recipe.servings,
      servingsTo: servingsTarget,
      ingredients: scaledIngredients
    });
  } catch (error: any) {
    console.error("Error scaling family recipe:", error);
    res.status(500).json({ error: error.message });
  }
});