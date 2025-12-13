import OpenAI from "openai";
import { smartCategorizationEngine } from "./smartCategorization";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MealAnalysis {
  completeMeals: Array<{
    name: string;
    ingredients: string[];
    difficulty: 'Easy' | 'Medium' | 'Advanced';
    cookTime: number;
    servings: number;
    cuisine: string;
  }>;
  partialMeals: Array<{
    name: string;
    availableIngredients: string[];
    missingIngredients: string[];
    completionPercentage: number;
  }>;
  suggestions: string[];
  nutritionBalance: {
    overall: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    protein: 'High' | 'Adequate' | 'Low';
    vegetables: 'High' | 'Adequate' | 'Low';
    variety: 'Excellent' | 'Good' | 'Limited';
    recommendations: string[];
  };
  shoppingOptimization: {
    missingEssentials: string[];
    budgetFriendlyAlternatives: string[];
    seasonalRecommendations: string[];
  };
}

export class MealCompletionEngine {
  private cache = new Map<string, MealAnalysis>();

  async analyzeMealReadiness(ingredients: string[]): Promise<MealAnalysis> {
    const cacheKey = ingredients.sort().join('|');
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Get ingredient analysis for better meal suggestions
      const ingredientAnalyses = await smartCategorizationEngine.analyzeIngredients(ingredients);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional chef and nutritionist. Analyze available ingredients and suggest complete meals, identify partial meals with missing ingredients, and provide nutrition balance assessment.

            Focus on:
            - Complete meals that can be made with available ingredients
            - Partial meals showing what's missing and completion percentage
            - Nutritional balance analysis (protein, vegetables, variety)
            - Smart shopping suggestions for meal completion
            
            Consider cooking difficulty, time, and practical home cooking.
            Respond in valid JSON matching the MealAnalysis interface.`
          },
          {
            role: "user",
            content: `Available ingredients: ${ingredients.join(', ')}\n\nAnalyze meal readiness and provide comprehensive suggestions.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const analysis: MealAnalysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate and enhance with ingredient insights
      const validatedAnalysis: MealAnalysis = {
        completeMeals: analysis.completeMeals || [],
        partialMeals: analysis.partialMeals || [],
        suggestions: analysis.suggestions || this.generateBasicSuggestions(ingredients),
        nutritionBalance: analysis.nutritionBalance || this.assessNutritionBalance(ingredientAnalyses),
        shoppingOptimization: analysis.shoppingOptimization || {
          missingEssentials: [],
          budgetFriendlyAlternatives: [],
          seasonalRecommendations: []
        }
      };

      this.cache.set(cacheKey, validatedAnalysis);
      return validatedAnalysis;

    } catch (error) {
      console.warn("Meal analysis failed, using fallback:", error);
      return this.getFallbackAnalysis(ingredients);
    }
  }

  async suggestMealPlan(ingredients: string[], days: number = 7): Promise<{
    mealPlan: Array<{
      day: string;
      breakfast: string;
      lunch: string;
      dinner: string;
      snacks: string[];
    }>;
    shoppingList: string[];
    nutritionSummary: any;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Create a balanced meal plan using available ingredients and suggest additional items needed.
            
            Provide:
            - Daily meal suggestions (breakfast, lunch, dinner, snacks)
            - Additional shopping list items needed
            - Nutrition summary for the week
            
            Focus on variety, balance, and practical home cooking.`
          },
          {
            role: "user",
            content: `Create a ${days}-day meal plan using these ingredients: ${ingredients.join(', ')}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      });

      return JSON.parse(response.choices[0].message.content || '{"mealPlan": [], "shoppingList": [], "nutritionSummary": {}}');

    } catch (error) {
      console.warn("Meal plan generation failed:", error);
      return {
        mealPlan: [],
        shoppingList: [],
        nutritionSummary: {}
      };
    }
  }

  private generateBasicSuggestions(ingredients: string[]): string[] {
    const suggestions = [];
    
    const hasProtein = ingredients.some(i => 
      ['chicken', 'beef', 'fish', 'eggs', 'tofu'].some(p => i.toLowerCase().includes(p))
    );
    const hasVegetables = ingredients.some(i => 
      ['lettuce', 'tomato', 'onion', 'carrot', 'pepper'].some(v => i.toLowerCase().includes(v))
    );
    const hasGrains = ingredients.some(i => 
      ['rice', 'bread', 'pasta', 'quinoa'].some(g => i.toLowerCase().includes(g))
    );

    if (!hasProtein) suggestions.push("Add a protein source like chicken, fish, or eggs");
    if (!hasVegetables) suggestions.push("Include more fresh vegetables for nutrition");
    if (!hasGrains) suggestions.push("Consider adding grains like rice or pasta for complete meals");

    return suggestions;
  }

  private assessNutritionBalance(ingredientAnalyses: Map<string, any>): MealAnalysis['nutritionBalance'] {
    let proteinCount = 0;
    let vegetableCount = 0;
    let totalIngredients = ingredientAnalyses.size;

    ingredientAnalyses.forEach((analysis) => {
      if (['Meats', 'Seafood', 'Dairy'].includes(analysis.category)) {
        proteinCount++;
      }
      if (analysis.category === 'Produce') {
        vegetableCount++;
      }
    });

    const proteinRatio = proteinCount / totalIngredients;
    const vegetableRatio = vegetableCount / totalIngredients;

    return {
      overall: totalIngredients > 10 ? 'Good' : 'Fair',
      protein: proteinRatio > 0.2 ? 'High' : proteinRatio > 0.1 ? 'Adequate' : 'Low',
      vegetables: vegetableRatio > 0.3 ? 'High' : vegetableRatio > 0.15 ? 'Adequate' : 'Low',
      variety: totalIngredients > 15 ? 'Excellent' : totalIngredients > 8 ? 'Good' : 'Limited',
      recommendations: [
        proteinRatio < 0.1 ? "Add more protein sources" : null,
        vegetableRatio < 0.15 ? "Increase vegetable variety" : null,
        totalIngredients < 8 ? "Expand ingredient variety for better nutrition" : null
      ].filter(Boolean) as string[]
    };
  }

  private getFallbackAnalysis(ingredients: string[]): MealAnalysis {
    return {
      completeMeals: [],
      partialMeals: [],
      suggestions: this.generateBasicSuggestions(ingredients),
      nutritionBalance: {
        overall: 'Fair',
        protein: 'Adequate',
        vegetables: 'Adequate',
        variety: 'Good',
        recommendations: ["Consider adding more variety to your ingredients"]
      },
      shoppingOptimization: {
        missingEssentials: ["cooking oil", "salt", "onions"],
        budgetFriendlyAlternatives: [],
        seasonalRecommendations: []
      }
    };
  }
}

export const mealCompletionEngine = new MealCompletionEngine();