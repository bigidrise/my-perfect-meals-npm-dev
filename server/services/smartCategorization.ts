import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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

      const analysis: IngredientAnalysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate and set defaults
      const validatedAnalysis: IngredientAnalysis = {
        category: analysis.category || this.getDefaultCategory(item),
        subCategory: analysis.subCategory || 'General',
        dietaryFlags: analysis.dietaryFlags || [],
        allergenWarnings: analysis.allergenWarnings || [],
        nutritionProfile: analysis.nutritionProfile || {
          calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0
        },
        cookingTips: analysis.cookingTips || [],
        sustainabilityScore: analysis.sustainabilityScore || 5,
        seasonality: analysis.seasonality || ['Year-round'],
        storageAdvice: analysis.storageAdvice || 'Store in cool, dry place'
      };

      // Cache the result
      this.cache.set(item.toLowerCase(), validatedAnalysis);
      return validatedAnalysis;

    } catch (error) {
      console.warn(`AI analysis failed for "${item}":`, error);
      return this.getDefaultAnalysis(item);
    }
  }

  // Batch analyze multiple ingredients for efficiency
  async analyzeIngredients(items: string[]): Promise<Map<string, IngredientAnalysis>> {
    const results = new Map<string, IngredientAnalysis>();
    
    // Process in parallel for better performance
    const analyses = await Promise.allSettled(
      items.map(item => this.analyzeIngredient(item))
    );

    items.forEach((item, index) => {
      const analysis = analyses[index];
      if (analysis.status === 'fulfilled') {
        results.set(item, analysis.value);
      } else {
        results.set(item, this.getDefaultAnalysis(item));
      }
    });

    return results;
  }

  private getDefaultCategory(item: string): string {
    const lower = item.toLowerCase();
    
    const categoryMappings = {
      'Produce': ['apple', 'banana', 'lettuce', 'tomato', 'onion', 'carrot', 'potato', 'avocado', 'spinach', 'bell pepper'],
      'Meats': ['chicken', 'beef', 'pork', 'turkey', 'bacon', 'ham', 'sausage'],
      'Seafood': ['fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
      'Grains': ['bread', 'rice', 'pasta', 'oats', 'quinoa', 'flour', 'cereal'],
      'Pantry': ['oil', 'salt', 'pepper', 'sugar', 'spice', 'sauce', 'vinegar', 'honey'],
      'Beverages': ['juice', 'coffee', 'tea', 'soda', 'water', 'wine', 'beer']
    };

    for (const [category, keywords] of Object.entries(categoryMappings)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return category;
      }
    }

    return 'Pantry';
  }

  private getDefaultAnalysis(item: string): IngredientAnalysis {
    return {
      category: this.getDefaultCategory(item),
      subCategory: 'General',
      dietaryFlags: [],
      allergenWarnings: [],
      nutritionProfile: {
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0
      },
      cookingTips: [],
      sustainabilityScore: 5,
      seasonality: ['Year-round'],
      storageAdvice: 'Store in cool, dry place'
    };
  }
}

export const smartCategorizationEngine = new SmartCategorizationEngine();