/**
 * Buffet Recommendation AI
 *
 * Produces THREE distinct AwayFromHomeRecommendation objects from a user's
 * description of foods physically available at a buffet. Each represents a
 * genuinely different protein-centered plate (e.g. steak plate, salmon plate,
 * chicken plate), not variations of the same meal.
 *
 * No Google Places. No Restaurant Intelligence Engine. No chain menu data.
 * Source: "buffet" · Nutrition status: always "estimated"
 *
 * Carb breakdown rule (enforced here, not in AI prompts):
 *   fibrousCarbGrams = fiberGrams  (application rule, not AI-derived)
 *   fiberGrams + starchyCarbGrams ≤ estimatedCarbGrams  (constraint in prompt)
 */

import OpenAI from "openai";
import type { AwayFromHomeRecommendation } from "@shared/awayFromHome";
import type { ActiveNutritionContext } from "./nutritionContext/getActiveNutritionContext";
import { buildCravingInstructions } from "./restaurantMealGeneratorAI";
import { randomUUID } from "crypto";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface BuffetRecommendationRequest {
  /** Free-form description of available foods, e.g. "grilled chicken, mashed potatoes, salad bar..." */
  foodsDescription: string;
  /** Optional structured categories (merged into the prompt alongside free-form text) */
  categories?: {
    proteins?: string;
    vegetables?: string;
    starches?: string;
    sauces?: string;
    desserts?: string;
    beverages?: string;
  };
  /** Unified nutrition context assembled by caller */
  nutritionContext: ActiveNutritionContext;
  /** Raw user row (for name, allergies, dietType) */
  user?: Record<string, unknown>;
  /** Specific food the user has requested (e.g. "salmon", "steak") — AI must feature it prominently */
  requestedFood?: string;
  /** Pre-built remaining-day macro budget block from buildRemainingMacrosBlock() */
  remainingMacrosBlock?: string;
  /** GLP-1 recommendation-surface guidance block from buildGLP1RecommendationBlock() */
  glp1RecommendationBlock?: string;
}

/** Derive fibrousCarbs from fiber (application rule — never ask AI for this) */
function deriveFibrousCarbGrams(fiberGrams: number | null | undefined): number | null {
  if (fiberGrams == null) return null;
  return fiberGrams;
}

/** Map a single parsed plate object → AwayFromHomeRecommendation */
function mapPlate(parsed: Record<string, unknown>): AwayFromHomeRecommendation {
  const buffetItems =
    (parsed.buffetItems as Array<{ food: string; portion: string; note?: string | null }> | undefined) ?? [];
  const cautionNotes = (parsed.cautionNotes as string[] | undefined) ?? [];

  const calories  = typeof parsed.estimatedCalories    === "number" ? parsed.estimatedCalories    : undefined;
  const protein   = typeof parsed.estimatedProteinGrams === "number" ? parsed.estimatedProteinGrams : undefined;
  const carbs     = typeof parsed.estimatedCarbGrams    === "number" ? parsed.estimatedCarbGrams    : undefined;
  const fat       = typeof parsed.estimatedFatGrams     === "number" ? parsed.estimatedFatGrams     : undefined;
  const calLow    = typeof parsed.caloriesLow           === "number" ? parsed.caloriesLow           : undefined;
  const calHigh   = typeof parsed.caloriesHigh          === "number" ? parsed.caloriesHigh          : undefined;

  // Carb breakdown — AI provides fiber and starchy; fibrous is derived
  const rawFiber   = typeof parsed.fiberGrams      === "number" ? parsed.fiberGrams      : null;
  const rawStarchy = typeof parsed.starchyCarbGrams === "number" ? parsed.starchyCarbGrams : null;
  const totalCarbs = carbs ?? 0;

  // Enforce constraint: fiber + starchy ≤ total carbs (clamp, never reject)
  let fiberGrams   = rawFiber   != null ? Math.min(rawFiber,   totalCarbs)                         : null;
  let starchyCarbs = rawStarchy != null ? Math.min(rawStarchy, totalCarbs - (fiberGrams ?? 0))      : null;

  // Application rule: fibrousCarbGrams = fiberGrams
  const fibrousCarbGrams = deriveFibrousCarbGrams(fiberGrams);

  const reasonParts: string[] = [];
  if (parsed.reason)          reasonParts.push(String(parsed.reason));
  if (parsed.medicalGuidance) reasonParts.push(String(parsed.medicalGuidance));

  return {
    id: randomUUID(),
    source: "buffet",
    restaurantName: "Buffet",
    nutritionStatus: "estimated",
    menuSourceDisclosure: "Estimates are based on typical preparation and serving size.",
    meal: {
      name: String(parsed.plateName ?? "Recommended Plate"),
      description: String(parsed.plateDescription ?? ""),
      calories,
      proteinGrams: protein,
      carbohydrateGrams: carbs,
      fatGrams: fat,
      fiberGrams,
      starchyCarbGrams: starchyCarbs,
      fibrousCarbGrams,
      ...(calLow != null && calHigh != null ? { caloriesRange: { low: calLow, high: calHigh } } : {}),
      ingredients: buffetItems.map((item) => `${item.food} (${item.portion})`),
    },
    recommendation: {
      reason: reasonParts.join(" "),
      portionGuidance: parsed.portionGuidance ? String(parsed.portionGuidance) : undefined,
      howToOrder: {
        askFor: "Build Your Plate",
        modify: [],
        swap: [],
      },
      cautionNotes: cautionNotes.length > 0 ? cautionNotes : undefined,
    },
    protocol: {
      alignmentSummary: parsed.protocolAlignmentSummary
        ? String(parsed.protocolAlignmentSummary)
        : undefined,
    },
    buffetItems: buffetItems.map((item) => ({
      food: item.food,
      portion: item.portion,
      note: item.note ?? undefined,
    })),
  };
}

export async function generateBuffetRecommendations(
  req: BuffetRecommendationRequest
): Promise<AwayFromHomeRecommendation[]> {
  const { foodsDescription, categories, nutritionContext, requestedFood, remainingMacrosBlock, glp1RecommendationBlock } = req;

  const foodsLines: string[] = [];
  if (foodsDescription.trim()) {
    foodsLines.push(`Available foods: ${foodsDescription.trim()}`);
  }
  if (categories) {
    if (categories.proteins)   foodsLines.push(`Proteins: ${categories.proteins}`);
    if (categories.vegetables) foodsLines.push(`Vegetables: ${categories.vegetables}`);
    if (categories.starches)   foodsLines.push(`Starches/Grains: ${categories.starches}`);
    if (categories.sauces)     foodsLines.push(`Sauces/Condiments: ${categories.sauces}`);
    if (categories.desserts)   foodsLines.push(`Desserts: ${categories.desserts}`);
    if (categories.beverages)  foodsLines.push(`Beverages: ${categories.beverages}`);
  }
  const foodsBlock = foodsLines.join("\n");

  const systemPrompt = `You are a clinical nutrition AI helping a user build the best plate at a buffet.
Your job is to return THREE completely distinct plate options built from the available foods.

Each plate must be centered on a DIFFERENT protein source (e.g. Plate 1: steak, Plate 2: salmon, Plate 3: chicken).
Do NOT return three variations of the same protein with different vegetables.
If fewer than three proteins are available, build genuinely different carb/fat strategies instead.

STRICT RULES:
- Only recommend foods from the list the user provides. Never invent items.
- Nutrition values are always estimated — never claim they are exact.
- Honor ALL dietary restrictions, allergies, and medical protocols exactly.
- Use buffet-appropriate language: "Build Your Plate", "Suggested Portions" — NOT waiter/ordering language.
- Estimate macros conservatively for a typical plate serving.
- caloriesLow/High should reflect realistic variation (±15–25% of center estimate).
- For each plate: fiberGrams + starchyCarbGrams MUST be ≤ estimatedCarbGrams.
- starchyCarbGrams: energy-dense carbs from rice, pasta, bread, potatoes, grains, beans, corn, peas.
- fiberGrams: volume-dense carbs from vegetables, leafy greens, broccoli, cauliflower, peppers, tomatoes, cucumbers.
- Vegetables ARE carbs (fibrous source) — never return 0 for fiberGrams if any vegetables are on the plate.
- Both fiberGrams and starchyCarbGrams are required fields. Never omit either.
- Do NOT produce a "fibrousCarbs" field — the application derives that from fiberGrams.

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "plates": [
    {
      "plateName": string,
      "plateDescription": string,
      "estimatedCalories": number,
      "estimatedProteinGrams": number,
      "estimatedCarbGrams": number,
      "estimatedFatGrams": number,
      "fiberGrams": number,
      "starchyCarbGrams": number,
      "caloriesLow": number,
      "caloriesHigh": number,
      "buffetItems": [{ "food": string, "portion": string, "note": string | null }],
      "reason": string,
      "portionGuidance": string,
      "cautionNotes": [string],
      "protocolAlignmentSummary": string,
      "medicalGuidance": string | null
    }
  ]
}`;

  // GLP-1 / craving intent: if the user requested a specific food, preserve it as
  // the anchor protein. For diabetic users, achieve carb compliance via sides only.
  const hasDiabetes = nutritionContext?.envelope?.hasDiabetes ?? false;
  const cravingInstructions = buildCravingInstructions(requestedFood, hasDiabetes);

  const userPrompt = `USER NUTRITION PROFILE:
${nutritionContext.combinedBlock || "(standard healthy adult — no active protocols)"}
${glp1RecommendationBlock ?? ""}
${cravingInstructions}
${remainingMacrosBlock ?? ""}

BUFFET FOODS AVAILABLE:
${foodsBlock}

Build THREE distinct protein-centered plates from the available foods. Respect all protocols strictly.`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 2400,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Buffet AI returned invalid JSON");
  }

  const plates = Array.isArray(parsed.plates) ? parsed.plates : [];
  if (plates.length === 0) {
    throw new Error("Buffet AI returned no plates");
  }

  return plates.map((plate) => mapPlate(plate as Record<string, unknown>));
}

/** @deprecated Use generateBuffetRecommendations (returns array of 3) */
export async function generateBuffetRecommendation(
  req: BuffetRecommendationRequest
) {
  const results = await generateBuffetRecommendations(req);
  return results[0];
}
