import OpenAI from "openai";

export interface CuisineMealCandidate {
  name: string;
  description: string;
  ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
  instructions: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  cookingTime: string;
  difficulty: "Easy" | "Medium";
}

export interface CuisineAssessment {
  index: number;
  compliant: boolean;
  reason: string;
}

export interface FridgeRescueCuisineProvider {
  assess(input: {
    cuisine: string;
    meals: CuisineMealCandidate[];
  }): Promise<CuisineAssessment[]>;
  repair(input: {
    cuisine: string;
    failedMeals: CuisineMealCandidate[];
    fridgeItems: string[];
    strictMode: boolean;
  }): Promise<CuisineMealCandidate[]>;
}

let openai: OpenAI | null = null;
function client(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

async function jsonCompletion(prompt: string): Promise<Record<string, unknown>> {
  const response = await client().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 2200,
    temperature: 0,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("CUISINE_VALIDATOR_EMPTY_RESPONSE");
  return JSON.parse(content) as Record<string, unknown>;
}

function parseMealCandidate(value: unknown, index: number): CuisineMealCandidate {
  if (!value || typeof value !== "object") {
    throw new Error(`CUISINE_REPAIR_INVALID_${index}`);
  }
  const meal = value as Record<string, unknown>;
  const ingredients = meal.ingredients;
  if (
    typeof meal.name !== "string" ||
    typeof meal.description !== "string" ||
    !Array.isArray(ingredients) ||
    typeof meal.instructions !== "string" ||
    typeof meal.calories !== "number" ||
    typeof meal.protein !== "number" ||
    typeof meal.carbs !== "number" ||
    typeof meal.fat !== "number" ||
    typeof meal.starchyCarbs !== "number" ||
    typeof meal.fibrousCarbs !== "number" ||
    typeof meal.cookingTime !== "string" ||
    (meal.difficulty !== "Easy" && meal.difficulty !== "Medium")
  ) {
    throw new Error(`CUISINE_REPAIR_INVALID_${index}`);
  }
  const parsedIngredients: CuisineMealCandidate["ingredients"] = [];
  for (const ingredient of ingredients) {
    if (!ingredient || typeof ingredient !== "object") {
      throw new Error(`CUISINE_REPAIR_INVALID_INGREDIENT_${index}`);
    }
    const item = ingredient as Record<string, unknown>;
    if (typeof item.name !== "string") {
      throw new Error(`CUISINE_REPAIR_INVALID_INGREDIENT_${index}`);
    }
    parsedIngredients.push({
      name: item.name,
      ...(typeof item.quantity === "string" ? { quantity: item.quantity } : {}),
      ...(typeof item.unit === "string" ? { unit: item.unit } : {}),
    });
  }
  return {
    name: meal.name,
    description: meal.description,
    ingredients: parsedIngredients,
    instructions: meal.instructions,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    starchyCarbs: meal.starchyCarbs,
    fibrousCarbs: meal.fibrousCarbs,
    cookingTime: meal.cookingTime,
    difficulty: meal.difficulty,
  };
}

const defaultProvider: FridgeRescueCuisineProvider = {
  async assess({ cuisine, meals }) {
    const result = await jsonCompletion(`You are a strict culinary identity validator.
Requested cuisine: ${cuisine}

Assess every candidate independently. A meal is compliant only when its dish structure,
preparation, flavor profile, and ingredients are culturally plausible within the requested
cuisine. A translated or cuisine-sounding name on a generic foreign dish is not compliant.
Dietary or clinical adaptations are allowed only when the result still clearly belongs to
the requested cuisine. Do not judge nutrition or medical safety.

Candidates:
${JSON.stringify(meals)}

Return JSON only:
{"assessments":[{"index":0,"compliant":true,"reason":"brief reason"}]}
Include exactly one assessment for every candidate index.`);
    if (!Array.isArray(result.assessments)) throw new Error("CUISINE_ASSESSMENT_INVALID");
    return result.assessments.map((value, index) => {
      const item = value as Record<string, unknown>;
      if (
        typeof item.index !== "number" ||
        typeof item.compliant !== "boolean" ||
        typeof item.reason !== "string"
      ) {
        throw new Error(`CUISINE_ASSESSMENT_INVALID_${index}`);
      }
      return { index: item.index, compliant: item.compliant, reason: item.reason };
    });
  },

  async repair({ cuisine, failedMeals, fridgeItems, strictMode }) {
    const ingredientRule = strictMode
      ? `Use only these supplied ingredients: ${fridgeItems.join(", ")}. Do not add ingredients.`
      : `Keep these supplied ingredients as the foundation: ${fridgeItems.join(", ")}.
You may add reasonable supporting pantry ingredients needed for ${cuisine} identity,
including safe seasonings, aromatics, herbs, sauces, and acids. Do not replace the supplied
food with an unrelated recipe.`;
    const result = await jsonCompletion(`You are repairing Fridge Rescue candidates that failed
strict ${cuisine} culinary identity validation.

${ingredientRule}
Rewrite each failed candidate as a culturally plausible ${cuisine} dish or adaptation.
Preserve all applicable dietary and medical characteristics visible in the candidate.
Return complete recipes with realistic nutrition estimates. Do not merely rename a generic dish.

Failed candidates:
${JSON.stringify(failedMeals)}

Return JSON only as {"meals":[...]}, in the same order and with exactly ${failedMeals.length}
complete meals. Each meal requires name, description, ingredients, instructions, calories,
protein, carbs, fat, starchyCarbs, fibrousCarbs, cookingTime, and difficulty.`);
    if (!Array.isArray(result.meals) || result.meals.length !== failedMeals.length) {
      throw new Error("CUISINE_REPAIR_INVALID");
    }
    return result.meals.map(parseMealCandidate);
  },
};

export async function enforceFridgeRescueCuisineCompliance<T extends CuisineMealCandidate>(
  input: {
    meals: T[];
    cuisine: string | null | undefined;
    fridgeItems: string[];
    strictMode: boolean;
  },
  provider: FridgeRescueCuisineProvider = defaultProvider,
): Promise<T[]> {
  const cuisine = input.cuisine?.trim();
  if (!cuisine || input.meals.length === 0) return input.meals;

  const assessments = await provider.assess({ cuisine, meals: input.meals });
  if (
    assessments.length !== input.meals.length ||
    assessments.some((assessment, index) => assessment.index !== index)
  ) {
    throw new Error("CUISINE_ASSESSMENT_INCOMPLETE");
  }

  const failedIndexes = assessments
    .filter((assessment) => !assessment.compliant)
    .map((assessment) => assessment.index);
  if (failedIndexes.length === 0) return input.meals;

  const repaired = await provider.repair({
    cuisine,
    failedMeals: failedIndexes.map((index) => input.meals[index]),
    fridgeItems: input.fridgeItems,
    strictMode: input.strictMode,
  });
  const repairAssessments = await provider.assess({ cuisine, meals: repaired });
  const acceptedRepairs = new Map<number, T>();
  repairAssessments.forEach((assessment, repairIndex) => {
    if (assessment.index === repairIndex && assessment.compliant) {
      const originalIndex = failedIndexes[repairIndex];
      acceptedRepairs.set(originalIndex, {
        ...input.meals[originalIndex],
        ...repaired[repairIndex],
      });
    }
  });

  return input.meals.flatMap((meal, index) => {
    if (!failedIndexes.includes(index)) return [meal];
    const replacement = acceptedRepairs.get(index);
    return replacement ? [replacement] : [];
  });
}