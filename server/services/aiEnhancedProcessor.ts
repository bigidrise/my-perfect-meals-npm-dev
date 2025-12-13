import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ProcessedIngredient {
  name: string;
  category: string;
  standardizedQuantity?: { amount: number; unit: string };
  nutritionScore?: number;
  seasonality?: string[];
  storageAdvice?: string;
  substitutions?: string[];
  enhancements: {
    aiCategorized: boolean;
    standardized: boolean;
    nutritionAnalyzed: boolean;
    smartSubstitutions: boolean;
  };
}

interface SmartConsolidation {
  canonical: string;
  variations: string[];
  totalQuantity: { amount: number; unit: string };
  confidence: number;
  reasoning: string;
}

class EnhancedIngredientProcessor {
  private categoryCache = new Map<string, string>();
  private nutritionCache = new Map<string, any>();

  // AI-powered ingredient processing with ChatGPT-level intelligence
  async processRawInput(rawInput: string): Promise<ProcessedIngredient> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a culinary AI expert specializing in ingredient analysis and shopping optimization. 
            Parse and enhance grocery items with professional-grade categorization, standardization, and nutritional insights.
            
            Categories: Produce, Meats, Dairy, Grains, Pantry, Frozen, Bakery, Beverages, Condiments, Snacks, Personal Care, Household
            
            Provide detailed analysis including:
            - Standardized name (remove brand names, standardize format)
            - Precise category classification
            - Quantity parsing and unit standardization
            - Nutrition score (1-10, 10 being healthiest)
            - Seasonal availability
            - Storage recommendations
            - Smart substitution suggestions
            
            Respond in JSON format matching the ProcessedIngredient interface.`
          },
          {
            role: "user",
            content: `Analyze and enhance this grocery item: "${rawInput}"`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1 // Low temperature for consistent, accurate results
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        name: analysis.name || rawInput,
        category: analysis.category || this.fallbackCategorize(rawInput),
        standardizedQuantity: analysis.standardizedQuantity,
        nutritionScore: analysis.nutritionScore,
        seasonality: analysis.seasonality || [],
        storageAdvice: analysis.storageAdvice,
        substitutions: analysis.substitutions || [],
        enhancements: {
          aiCategorized: true,
          standardized: !!analysis.standardizedQuantity,
          nutritionAnalyzed: !!analysis.nutritionScore,
          smartSubstitutions: !!analysis.substitutions?.length
        }
      };
    } catch (error) {
      console.warn("AI processing failed, using fallback:", error);
      return this.fallbackProcess(rawInput);
    }
  }

  // Advanced ingredient consolidation using AI reasoning
  async intelligentConsolidate(ingredients: Array<{name: string, amount: number, unit: string}>): Promise<SmartConsolidation[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert grocery consolidation AI. Group similar ingredients intelligently, considering:
            
            1. Semantic similarity (chicken breast, boneless chicken, etc.)
            2. Unit compatibility and conversion
            3. Brand variations vs. generic names
            4. Size variations (large eggs vs. eggs)
            5. Quality descriptors (organic, free-range, etc.)
            
            For each group, provide:
            - Canonical name (most common/standard form)
            - All variations found
            - Total consolidated quantity
            - Confidence score (0-1)
            - Brief reasoning for grouping decision
            
            Only group items that are truly the same ingredient. When in doubt, keep separate.
            Respond in JSON array format.`
          },
          {
            role: "user",
            content: `Consolidate these ingredients intelligently:\n${JSON.stringify(ingredients, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const consolidation = JSON.parse(response.choices[0].message.content || '{"consolidations": []}');
      return consolidation.consolidations || [];
    } catch (error) {
      console.warn("AI consolidation failed, using basic grouping:", error);
      return this.basicConsolidate(ingredients);
    }
  }

  // Intelligent shopping list optimization
  async optimizeShoppingRoute(items: Array<{name: string, category: string}>): Promise<{
    optimizedOrder: Array<{name: string, category: string, aisle?: string}>;
    estimatedTime: number;
    suggestions: string[];
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a shopping efficiency expert. Optimize shopping lists for minimal store traversal time.
            
            Consider typical grocery store layouts:
            - Produce (entrance area)
            - Bakery (front/side)
            - Deli/Meat (perimeter)
            - Dairy (back wall)
            - Frozen (back/side aisles)
            - Packaged goods (center aisles)
            - Personal care (back corner)
            
            Provide optimized shopping order, time estimate, and efficiency tips.
            Respond in JSON format.`
          },
          {
            role: "user",
            content: `Optimize shopping route for: ${JSON.stringify(items, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content || '{"optimizedOrder": [], "estimatedTime": 0, "suggestions": []}');
    } catch (error) {
      console.warn("Route optimization failed:", error);
      return {
        optimizedOrder: items,
        estimatedTime: Math.ceil(items.length * 1.5), // Fallback: 1.5 min per item
        suggestions: ["Shop perimeter first", "Group by store section", "Bring reusable bags"]
      };
    }
  }

  // Smart meal planning suggestions based on shopping list
  async generateMealSuggestions(ingredients: string[]): Promise<{
    suggestedMeals: Array<{name: string, ingredients: string[], difficulty: string, cookTime: number}>;
    missingIngredients: string[];
    nutritionBalance: string;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional chef and nutritionist AI. Based on available ingredients, suggest balanced, practical meals.
            
            Consider:
            - Ingredient synergy and flavor profiles
            - Nutritional balance (protein, carbs, fats, vitamins)
            - Cooking complexity and time requirements
            - Minimizing food waste
            - Dietary versatility
            
            Suggest 3-5 meals with difficulty levels (Easy/Medium/Advanced) and cook times.
            Identify any key missing ingredients for better meal options.
            Provide nutrition balance assessment.
            
            Respond in JSON format.`
          },
          {
            role: "user",
            content: `Available ingredients: ${ingredients.join(', ')}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      });

      return JSON.parse(response.choices[0].message.content || '{"suggestedMeals": [], "missingIngredients": [], "nutritionBalance": ""}');
    } catch (error) {
      console.warn("Meal suggestion failed:", error);
      return {
        suggestedMeals: [],
        missingIngredients: [],
        nutritionBalance: "Unable to analyze nutrition balance"
      };
    }
  }

  // Fallback methods for when AI is unavailable
  private fallbackProcess(rawInput: string): ProcessedIngredient {
    return {
      name: rawInput.trim(),
      category: this.fallbackCategorize(rawInput),
      enhancements: {
        aiCategorized: false,
        standardized: false,
        nutritionAnalyzed: false,
        smartSubstitutions: false
      }
    };
  }

  private fallbackCategorize(item: string): string {
    const lower = item.toLowerCase();
    const categories = {
      'Produce': ['apple', 'banana', 'lettuce', 'tomato', 'onion', 'carrot', 'potato', 'avocado'],
      'Meats': ['chicken', 'beef', 'pork', 'fish', 'salmon', 'turkey', 'bacon'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'eggs', 'cream'],
      'Grains': ['bread', 'rice', 'pasta', 'oats', 'quinoa', 'flour'],
      'Pantry': ['oil', 'salt', 'pepper', 'sugar', 'spice', 'sauce', 'vinegar']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return category;
      }
    }
    return 'Pantry';
  }

  private basicConsolidate(ingredients: Array<{name: string, amount: number, unit: string}>): SmartConsolidation[] {
    const groups = new Map<string, Array<{name: string, amount: number, unit: string}>>();
    
    ingredients.forEach(item => {
      const key = item.name.toLowerCase().trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      canonical: items[0].name,
      variations: items.map(i => i.name),
      totalQuantity: {
        amount: items.reduce((sum, i) => sum + i.amount, 0),
        unit: items[0].unit
      },
      confidence: items.length > 1 ? 0.8 : 1.0,
      reasoning: items.length > 1 ? 'Grouped identical items' : 'Single item'
    }));
  }
}

export const enhancedIngredientProcessor = new EnhancedIngredientProcessor();