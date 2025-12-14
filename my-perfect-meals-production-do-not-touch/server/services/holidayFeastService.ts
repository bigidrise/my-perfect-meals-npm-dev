// server/services/holidayFeastService.ts
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Counts = {
  appetizers: number;
  mainDishes: number;
  sideDishes: number;
  desserts: number;
};
type FamilyRecipe = {
  name: string;
  ingredients?: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    prep?: string;
  }>;
  mealType?: "appetizer" | "main" | "side" | "dessert";
  servings?: number;
  instructions?: string[];
};

type MealOut = {
  name: string;
  description?: string;
  course: "appetizers" | "mainDishes" | "sideDishes" | "desserts";
  servings: number;
  ingredients: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    prep?: string;
  }>;
  instructions: string[]; // steps only
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  imageUrl?: string;
  imagePrompt?: string;
};

export async function generateHolidayFeast(input: {
  occasion: string;
  servings: number;
  counts: Counts;
  dietaryRestrictions: string[];
  cuisineType?: string;
  budgetLevel: "low" | "moderate" | "high";
  familyRecipe?: FamilyRecipe;
}): Promise<{
  feast: MealOut[];
  recipes: MealOut[]; // family recipe (if provided) returns here
  colorTheme: { primary: string; secondary: string; accent: string };
}> {
  const {
    occasion,
    servings,
    counts,
    dietaryRestrictions,
    cuisineType,
    budgetLevel,
    familyRecipe,
  } = input;

  const total =
    (counts.appetizers || 0) +
    (counts.mainDishes || 0) +
    (counts.sideDishes || 0) +
    (counts.desserts || 0);

  const system = `You are a professional recipe developer for large gatherings. 
Return STRICT JSON. No prose. 
All ingredients MUST be scaled for exactly ${servings} guests. 
Instructions must be step-by-step, concrete cooking actions (no vague fluff, no serving tips).`;

  const user = `
Create a ${occasion} feast with EXACTLY these counts:
- ${counts.appetizers} appetizers (course: "appetizers")
- ${counts.mainDishes} main dishes (course: "mainDishes") 
- ${counts.sideDishes} side dishes (course: "sideDishes")
- ${counts.desserts} desserts (course: "desserts")

Cuisine focus: ${cuisineType || "any appropriate"}
Dietary constraints (if any): ${dietaryRestrictions.join(", ") || "none"}
Budget level: ${budgetLevel}

ABSOLUTE REQUIREMENTS - FAILURE TO FOLLOW MEANS REJECTION:
1. Generate EXACTLY ${counts.appetizers + counts.mainDishes + counts.sideDishes + counts.desserts} total dishes
2. MUST have exactly ${counts.appetizers} dishes with "course": "appetizers"
3. MUST have exactly ${counts.mainDishes} dishes with "course": "mainDishes"  
4. MUST have exactly ${counts.sideDishes} dishes with "course": "sideDishes"
5. MUST have exactly ${counts.desserts} dishes with "course": "desserts"
6. Every dish MUST include "servings": ${servings} (number)
7. Scale all ingredient quantities to ${servings} people
8. Use common cooking units (g, kg, oz, lb, tsp, tbsp, cup, ml, l, piece)
9. Provide only actionable cooking steps (array of strings), no commentary

DISTRIBUTION VERIFICATION:
Total dishes required: ${counts.appetizers + counts.mainDishes + counts.sideDishes + counts.desserts}
Breakdown: ${counts.appetizers} appetizers + ${counts.mainDishes} mains + ${counts.sideDishes} sides + ${counts.desserts} desserts = ${counts.appetizers + counts.mainDishes + counts.sideDishes + counts.desserts} total

JSON schema (STRICT):
{
  "feast": [
    {
      "name": "string",
      "description": "string",
      "course": "appetizers" | "mainDishes" | "sideDishes" | "desserts",
      "servings": ${servings},
      "ingredients": [
        { "name": "string", "quantity": number, "unit": "g"|"kg"|"oz"|"lb"|"tsp"|"tbsp"|"cup"|"ml"|"l"|"piece", "prep": "string" }
      ],
      "instructions": ["Step 1...", "Step 2..."],
      "nutrition": { "calories": number, "protein": number, "carbs": number, "fat": number },
      "imagePrompt": "short visual prompt"
    }
  ]
}
`.trim();

  const resp = await openai.chat.completions.create({
    model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    temperature: 1,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });

  const raw = resp.choices?.[0]?.message?.content || "{}";
  
  // Log the raw response for debugging
  console.log("🔍 Raw GPT-5 Response:");
  console.log("Length:", raw.length);
  console.log("Content:", raw);
  
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
    console.log("✅ JSON parsed successfully");
  } catch (parseError: any) {
    console.error("❌ JSON parsing failed:");
    console.error("Error:", parseError.message);
    console.error("Raw content:", raw);
    
    // Try to clean the response
    const cleaned = raw.trim().replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    console.log("🧹 Attempting to clean response:", cleaned);
    
    try {
      parsed = JSON.parse(cleaned);
      console.log("✅ Cleaned JSON parsed successfully");
    } catch (cleanError) {
      console.error("❌ Even cleaned JSON failed to parse");
      throw new Error(`Model returned invalid JSON: ${parseError.message}`);
    }
  }

  const normalizeUnit = (u?: string) => {
    if (!u) return undefined;
    const key = u.toLowerCase();
    const map: Record<string, string> = {
      grams: "g",
      g: "g",
      kilogram: "kg",
      kilograms: "kg",
      kg: "kg",
      ounce: "oz",
      ounces: "oz",
      oz: "oz",
      pound: "lb",
      pounds: "lb",
      lb: "lb",
      lbs: "lb",
      teaspoon: "tsp",
      teaspoons: "tsp",
      tsp: "tsp",
      tablespoon: "tbsp",
      tablespoons: "tbsp",
      tbsp: "tbsp",
      cup: "cup",
      cups: "cup",
      milliliter: "ml",
      milliliters: "ml",
      ml: "ml",
      liter: "l",
      liters: "l",
      l: "l",
      piece: "piece",
      pieces: "piece",
    };
    return map[key] || u;
  };

  const roundTenth = (n?: number) =>
    typeof n === "number" && isFinite(n) ? Math.round(n * 10) / 10 : undefined;

  const coerceDish = (d: any): MealOut => ({
    name: String(d.name ?? "Untitled Dish"),
    description: d.description ? String(d.description) : undefined,
    course: (["appetizers", "mainDishes", "sideDishes", "desserts"].includes(
      d.course,
    )
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
          calories: d.nutrition.calories
            ? Math.round(Number(d.nutrition.calories))
            : undefined,
          protein: d.nutrition.protein
            ? Math.round(Number(d.nutrition.protein))
            : undefined,
          carbs: d.nutrition.carbs
            ? Math.round(Number(d.nutrition.carbs))
            : undefined,
          fat: d.nutrition.fat
            ? Math.round(Number(d.nutrition.fat))
            : undefined,
        }
      : undefined,
    imagePrompt: d.imagePrompt ? String(d.imagePrompt) : undefined,
  });

  let feast: MealOut[] = Array.isArray(parsed.feast)
    ? parsed.feast.map(coerceDish)
    : [];

  // Verify we got the right counts - log what we actually received
  const actualCounts = {
    appetizers: feast.filter(d => d.course === "appetizers").length,
    mainDishes: feast.filter(d => d.course === "mainDishes").length,
    sideDishes: feast.filter(d => d.course === "sideDishes").length,
    desserts: feast.filter(d => d.course === "desserts").length,
  };
  
  console.log("🔍 Expected counts:", counts);
  console.log("🔍 Actual counts:", actualCounts);
  console.log("🔍 Total dishes generated:", feast.length);
  
  // If counts don't match, we need to regenerate
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
      servings: input.servings, // force to event size so your UI stays consistent
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

  // 🎨 Generate images for each dish using DALL-E
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

  // (Fun bit for your gradients – fixed palette per occasion)
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
