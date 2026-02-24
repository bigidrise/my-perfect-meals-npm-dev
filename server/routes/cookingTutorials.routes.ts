import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../middleware/requireAuth";
import { requireActiveAccess } from "../middleware/requireActiveAccess";

const r = Router();

// Mock user ID for testing
const TEST_USER_ID = "test-user-123";

// Initialize OpenAI
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// AI-powered feedback for user-created recipes
r.post("/get-recipe-feedback", requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { recipe } = req.body;

    if (!recipe || !recipe.title || !recipe.ingredients || !recipe.instructions) {
      return res.status(400).json({ error: "Recipe title, ingredients, and instructions are required" });
    }

    // Construct a detailed prompt for recipe feedback
    const prompt = `
You are an expert chef and culinary instructor. Please provide detailed, constructive feedback on this recipe:

Title: ${recipe.title}
Ingredients: ${Array.isArray(recipe.ingredients) ? recipe.ingredients.join(', ') : recipe.ingredients}
Instructions: ${Array.isArray(recipe.instructions) ? recipe.instructions.join('. ') : recipe.instructions}

Please provide feedback on:
1. Ingredient balance and quality
2. Cooking technique and method
3. Flavor profile and seasoning
4. Presentation suggestions
5. Nutritional considerations
6. Skill level appropriateness
7. Potential improvements

Format your response as constructive, encouraging feedback that helps the cook improve their skills.
`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a professional chef and culinary instructor providing helpful, encouraging feedback to home cooks."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const feedback = response.choices[0]?.message?.content || "Unable to generate feedback at this time.";

    res.json({ feedback });
  } catch (error: any) {
    console.error("Error generating recipe feedback:", error);
    res.status(500).json({ 
      error: "Failed to generate recipe feedback",
      details: error.message 
    });
  }
});

// Create a new user recipe
r.post("/user-recipes", requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { title, ingredients, instructions, tips, videoUrl, userId = TEST_USER_ID } = req.body;

    if (!title || !ingredients || !instructions) {
      return res.status(400).json({ error: "Title, ingredients, and instructions are required" });
    }

    // In a real app, this would save to database
    // For now, return the created recipe with an ID
    const userRecipe = {
      id: `user-recipe-${Date.now()}`,
      userId,
      title,
      ingredients: Array.isArray(ingredients) ? ingredients : ingredients.split(',').map((i: string) => i.trim()),
      instructions: Array.isArray(instructions) ? instructions : instructions.split('\n').filter((i: string) => i.trim()),
      tips: tips || '',
      videoUrl: videoUrl || '',
      createdAt: new Date().toISOString(),
      status: 'pending_review'
    };

    res.json({ recipe: userRecipe, message: "Recipe submitted successfully!" });
  } catch (error: any) {
    console.error("Error creating user recipe:", error);
    res.status(500).json({ 
      error: "Failed to create recipe",
      details: error.message 
    });
  }
});

// Get user's created recipes
r.get("/user-recipes/:userId", requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    // In a real app, this would fetch from database
    // For now, return empty array as we don't have persistence
    const userRecipes: any[] = [];

    res.json({ recipes: userRecipes });
  } catch (error: any) {
    console.error("Error fetching user recipes:", error);
    res.status(500).json({ 
      error: "Failed to fetch recipes",
      details: error.message 
    });
  }
});

// Generate cooking challenge suggestions
r.post("/generate-cooking-challenge", requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { theme, difficulty = "beginner", timeLimit = 60 } = req.body;

    const prompt = `
Create a fun cooking challenge with these parameters:
Theme: ${theme || 'general cooking'}
Difficulty: ${difficulty}
Time Limit: ${timeLimit} minutes

Generate a JSON response with:
{
  "title": "Challenge name",
  "description": "Brief description",
  "instructions": ["step 1", "step 2", "step 3"],
  "judging_criteria": ["criteria 1", "criteria 2", "criteria 3"],
  "tips": ["tip 1", "tip 2"],
  "estimated_time": number_in_minutes
}
`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a culinary expert creating fun and educational cooking challenges. Respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.8,
    });

    const challenge = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    res.json({ challenge });
  } catch (error: any) {
    console.error("Error generating cooking challenge:", error);
    res.status(500).json({ 
      error: "Failed to generate challenge",
      details: error.message 
    });
  }
});

export default r;