// server/services/holidayFeastService.ts
import OpenAI from "openai";

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

export type MealOut = {
  name: string;
  description?: string;
  course: "appetizers" | "mainDishes" | "sideDishes" | "desserts";
  servings: number;
  ingredients: { name: string; quantity?: number; unit?: string; prep?: string }[];
  instructions: string[];
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  imagePrompt?: string;
  imageUrl?: string;
};

export type HolidayFeastInput = {
  occasion: string;
  servings: number;
  counts: {
    appetizers: number;
    mainDishes: number;
    sideDishes: number;
    desserts: number;
  };
  dietaryRestrictions?: string[];
  cuisineType?: string;
  budgetLevel?: "low" | "moderate" | "high";
  familyRecipe?: {
    name: string;
    ingredients?: { name: string; quantity?: number; unit?: string; prep?: string }[];
    mealType?: "appetizer" | "main" | "side" | "dessert";
    servings?: number;
    instructions?: string[];
  };
};

export type HolidayFeastOutput = {
  feast: MealOut[];
  recipes: MealOut[];
  colorTheme: { primary: string; secondary: string; accent: string };
};

export async function generateHolidayFeast(input: HolidayFeastInput): Promise<HolidayFeastOutput> {
  const { occasion, servings, counts, dietaryRestrictions = [], cuisineType, budgetLevel = "moderate", familyRecipe } = input;

  const systemPrompt = `You are a professional chef specializing in holiday feast planning. Create delicious, practical recipes with accurate nutrition estimates. Respond ONLY with valid JSON.`;

  const userPrompt = `Create a ${occasion} feast menu for ${servings} guests.

Required dishes:
- ${counts.appetizers} appetizers
- ${counts.mainDishes} main dishes  
- ${counts.sideDishes} side dishes
- ${counts.desserts} desserts

${dietaryRestrictions.length > 0 ? `Dietary restrictions: ${dietaryRestrictions.join(", ")}` : ""}
${cuisineType ? `Cuisine preference: ${cuisineType}` : ""}
Budget level: ${budgetLevel}

Respond with this exact JSON structure:
{
  "feast": [
    {
      "name": "Dish Name",
      "description": "Brief description",
      "course": "appetizers|mainDishes|sideDishes|desserts",
      "ingredients": [
        {"name": "ingredient", "quantity": 1, "unit": "cup", "prep": "chopped"}
      ],
      "instructions": ["Step 1", "Step 2"],
      "nutrition": {"calories": 250, "protein": 12, "carbs": 30, "fat": 8},
      "imagePrompt": "food photography prompt for this dish"
    }
  ]
}`;

  const resp = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  });

  const raw = resp.choices?.[0]?.message?.content || "{}";
  
  console.log("🔍 Raw GPT Response:");
  console.log("Length:", raw.length);
  
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
    console.log("✅ JSON parsed successfully");
  } catch (parseError: any) {
    console.error("❌ JSON parsing failed:", parseError.message);
    const cleaned = raw.trim().replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    try {
      parsed = JSON.parse(cleaned);
      console.log("✅ Cleaned JSON parsed successfully");
    } catch (cleanError) {
      throw new Error(`Model returned invalid JSON: ${parseError.message}`);
    }
  }

  const normalizeUnit = (u?: string) => {
    if (!u) return undefined;
    const key = u.toLowerCase();
    const map: Record<string, string> = {
      grams: "g", g: "g",
      kilogram: "kg", kilograms: "kg", kg: "kg",
      ounce: "oz", ounces: "oz", oz: "oz",
      pound: "lb", pounds: "lb", lb: "lb", lbs: "lb",
      teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp",
      tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp",
      cup: "cup", cups: "cup",
      milliliter: "ml", milliliters: "ml", ml: "ml",
      liter: "l", liters: "l", l: "l",
      piece: "piece", pieces: "piece",
    };
    return map[key] || u;
  };

  const roundTenth = (n?: number) =>
    typeof n === "number" && isFinite(n) ? Math.round(n * 10) / 10 : undefined;

  const coerceDish = (d: any): MealOut => ({
    name: String(d.name ?? "Untitled Dish"),
    description: d.description ? String(d.description) : undefined,
    course: (["appetizers", "mainDishes", "sideDishes", "desserts"].includes(d.course)
      ? d.course
      : "sideDishes") as MealOut["course"],
    servings,
    ingredients: Array.isArray(d.ingredients)
      ? d.ingredients.map((ing: any) => ({
          name: String(ing.name ?? ""),
          quantity: roundTenth(ing.quantity),
          unit: normalizeUnit(ing.unit),
          prep: ing.prep ? String(ing.prep) : undefined,
        }))
      : [],
    instructions: Array.isArray(d.instructions)
      ? d.instructions.map((s: any) => String(s))
      : [],
    nutrition: d.nutrition
      ? {
          calories: d.nutrition.calories ? Math.round(Number(d.nutrition.calories)) : undefined,
          protein: d.nutrition.protein ? Math.round(Number(d.nutrition.protein)) : undefined,
          carbs: d.nutrition.carbs ? Math.round(Number(d.nutrition.carbs)) : undefined,
          fat: d.nutrition.fat ? Math.round(Number(d.nutrition.fat)) : undefined,
        }
      : undefined,
    imagePrompt: d.imagePrompt ? String(d.imagePrompt) : undefined,
  });

  let feast: MealOut[] = Array.isArray(parsed.feast)
    ? parsed.feast.map(coerceDish)
    : [];

  const actualCounts = {
    appetizers: feast.filter(d => d.course === "appetizers").length,
    mainDishes: feast.filter(d => d.course === "mainDishes").length,
    sideDishes: feast.filter(d => d.course === "sideDishes").length,
    desserts: feast.filter(d => d.course === "desserts").length,
  };
  
  console.log("🔍 Expected counts:", counts);
  console.log("🔍 Actual counts:", actualCounts);
  console.log("🔍 Total dishes generated:", feast.length);
  
  const totalExpected = counts.appetizers + counts.mainDishes + counts.sideDishes + counts.desserts;
  if (feast.length !== totalExpected) {
    console.warn(`⚠️ Generated ${feast.length} dishes but expected ${totalExpected}!`);
  }

  const recipes: MealOut[] = [];
  if (familyRecipe?.name) {
    recipes.push({
      name: familyRecipe.name,
      description: "Family recipe",
      course:
        familyRecipe.mealType === "appetizer"
          ? "appetizers"
          : familyRecipe.mealType === "main"
            ? "mainDishes"
            : familyRecipe.mealType === "side"
              ? "sideDishes"
              : "desserts",
      servings: input.servings,
      ingredients: (familyRecipe.ingredients || []).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit ? normalizeUnit(i.unit) : undefined,
        prep: i.prep,
      })),
      instructions: familyRecipe.instructions || [],
      nutrition: undefined,
      imagePrompt: `${familyRecipe.name}, plated holiday style`,
    });
  }

  console.log(`🎨 Generating images for ${feast.length} dishes...`);
  
  const { generateImage } = await import("./imageService");
  
  for (const dish of feast) {
    if (dish.imagePrompt) {
      console.log(`🎨 Generating image for: ${dish.name}`);
      const imageUrl = await generateImage({
        name: dish.name,
        description: dish.description,
        type: 'meal',
        style: 'holiday feast photography'
      });
      
      if (imageUrl) {
        (dish as any).imageUrl = imageUrl;
        console.log(`✅ Generated image for: ${dish.name}`);
      } else {
        console.log(`⚠️ No image generated for: ${dish.name}`);
      }
    }
  }

  const colorTheme = paletteForOccasion(occasion);

  return { feast, recipes, colorTheme };
}

function paletteForOccasion(occasion: string) {
  const o = occasion.toLowerCase();
  if (o.includes("thanks"))
    return { primary: "#EA580C", secondary: "#F59E0B", accent: "#16A34A" };
  if (o.includes("christ"))
    return { primary: "#DC2626", secondary: "#16A34A", accent: "#B91C1C" };
  if (o.includes("hallow"))
    return { primary: "#EA580C", secondary: "#7E22CE", accent: "#0EA5E9" };
  if (o.includes("easter"))
    return { primary: "#EC4899", secondary: "#8B5CF6", accent: "#22C55E" };
  if (o.includes("new year"))
    return { primary: "#F59E0B", secondary: "#10B981", accent: "#EF4444" };
  if (o.includes("hanukkah"))
    return { primary: "#2563EB", secondary: "#60A5FA", accent: "#1E3A8A" };
  if (o.includes("fourth") || o.includes("independence") || o.includes("july"))
    return { primary: "#1D4ED8", secondary: "#DC2626", accent: "#F3F4F6" };
  return { primary: "#059669", secondary: "#10B981", accent: "#34D399" };
}
