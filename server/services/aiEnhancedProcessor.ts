import OpenAI from "openai";

// DO NOT CHANGE MODEL UNLESS EXPLICITLY REQUESTED
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

// ---- TYPES ----

export interface ProcessedIngredient {
  name: string;
  category: string;
  standardizedQuantity?: any;
  nutritionScore?: any;
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

export interface SmartConsolidation {
  canonical: string;
  variations: string[];
  totalQuantity: {
    amount: number;
    unit: string;
  };
  confidence: number;
  reasoning: string;
}

// ---- CLASS ----

class EnhancedIngredientProcessor {
  async processIngredient(rawInput: string): Promise<ProcessedIngredient> {
    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Analyze and normalize this grocery ingredient.",
          },
          {
            role: "user",
            content: rawInput,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const analysis = JSON.parse(response.choices[0].message.content || "{}");

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
          smartSubstitutions: !!analysis.substitutions?.length,
        },
      };
    } catch (error) {
      console.warn("AI processing failed, using fallback:", error);
      return this.fallbackProcess(rawInput);
    }
  }

  async intelligentConsolidate(
    ingredients: Array<{ name: string; amount: number; unit: string }>,
  ): Promise<SmartConsolidation[]> {
    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Consolidate similar grocery ingredients. Return JSON.",
          },
          { role: "user", content: JSON.stringify(ingredients) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const parsed = JSON.parse(
        response.choices[0].message.content || '{"consolidations": []}',
      );

      return parsed.consolidations || [];
    } catch (error) {
      console.warn("AI consolidation failed:", error);
      return this.basicConsolidate(ingredients);
    }
  }

  private fallbackProcess(rawInput: string): ProcessedIngredient {
    return {
      name: rawInput.trim(),
      category: this.fallbackCategorize(rawInput),
      enhancements: {
        aiCategorized: false,
        standardized: false,
        nutritionAnalyzed: false,
        smartSubstitutions: false,
      },
    };
  }

  private fallbackCategorize(item: string): string {
    const lower = item.toLowerCase();

    const categories: Record<string, string[]> = {
      Produce: ["apple", "banana", "lettuce", "tomato", "onion", "carrot"],
      Meats: ["chicken", "beef", "pork", "fish"],
      Dairy: ["milk", "cheese", "yogurt", "butter", "eggs"],
      Grains: ["bread", "rice", "pasta", "oats"],
      Pantry: ["oil", "salt", "pepper", "sugar"],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((k) => lower.includes(k))) {
        return category;
      }
    }

    return "Pantry";
  }

  private basicConsolidate(
    ingredients: Array<{ name: string; amount: number; unit: string }>,
  ): SmartConsolidation[] {
    const groups = new Map<
      string,
      Array<{ name: string; amount: number; unit: string }>
    >();

    for (const item of ingredients) {
      const key = item.name.toLowerCase().trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      canonical: items[0].name,
      variations: items.map((i) => i.name),
      totalQuantity: {
        amount: items.reduce((sum, i) => sum + i.amount, 0),
        unit: items[0].unit,
      },
      confidence: items.length > 1 ? 0.8 : 1.0,
      reasoning: items.length > 1 ? "Grouped identical items" : "Single item",
    }));
  }
}

export const enhancedIngredientProcessor = new EnhancedIngredientProcessor();
