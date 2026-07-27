/**
 * Buffet Recommendation AI
 *
 * Produces an AwayFromHomeRecommendation from a user's description of
 * foods physically available at a buffet. No Google Places, no Restaurant
 * Intelligence Engine, no chain menu data.
 *
 * Source: "buffet"
 * Nutrition status: always "estimated"
 */

import OpenAI from "openai";
import type { AwayFromHomeRecommendation } from "@shared/awayFromHome";
import type { ActiveNutritionContext } from "./nutritionContext/getActiveNutritionContext";
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
}

export async function generateBuffetRecommendation(
  req: BuffetRecommendationRequest
): Promise<AwayFromHomeRecommendation> {
  const { foodsDescription, categories, nutritionContext } = req;

  // ── Build available-foods block ─────────────────────────────────────────────
  const foodsLines: string[] = [];
  if (foodsDescription.trim()) {
    foodsLines.push(`Available foods: ${foodsDescription.trim()}`);
  }
  if (categories) {
    if (categories.proteins)    foodsLines.push(`Proteins: ${categories.proteins}`);
    if (categories.vegetables)  foodsLines.push(`Vegetables: ${categories.vegetables}`);
    if (categories.starches)    foodsLines.push(`Starches/Grains: ${categories.starches}`);
    if (categories.sauces)      foodsLines.push(`Sauces/Condiments: ${categories.sauces}`);
    if (categories.desserts)    foodsLines.push(`Desserts: ${categories.desserts}`);
    if (categories.beverages)   foodsLines.push(`Beverages: ${categories.beverages}`);
  }
  const foodsBlock = foodsLines.join("\n");

  const systemPrompt = `You are a clinical nutrition AI helping a user build the best plate at a buffet.
Your job is to analyze the foods physically available and recommend the optimal plate for the user's active nutrition profile.

STRICT RULES:
- Only recommend foods from the list the user provides. Never invent items.
- Nutrition values are always estimated — never claim they are exact.
- Honor ALL dietary restrictions, allergies, and medical protocols exactly.
- Use buffet-appropriate language: "How to Build Your Plate", "Suggested Portions", "What to Limit" — NOT waiter/ordering language.
- If the user's protocol requires it (e.g. GLP-1, diabetic, anti-inflammatory), adjust portions and food choices accordingly.
- Provide a second-choice plate option when practical.
- Estimate macros conservatively for a typical plate serving.
- caloriesRange low/high should reflect realistic variation (±15–25% of center estimate).

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "plateName": string,
  "plateDescription": string,
  "estimatedCalories": number,
  "estimatedProteinGrams": number,
  "estimatedCarbGrams": number,
  "estimatedFatGrams": number,
  "estimatedFiberGrams": number,
  "caloriesLow": number,
  "caloriesHigh": number,
  "buffetItems": [{ "food": string, "portion": string, "note": string | null }],
  "foodsToPrioritize": [string],
  "foodsToLimitOrSkip": [string],
  "reason": string,
  "portionGuidance": string,
  "secondChoicePlate": string | null,
  "cautionNotes": [string],
  "dessertOrBeverageGuidance": string | null,
  "protocolAlignmentSummary": string,
  "medicalGuidance": string | null
}`;

  const userPrompt = `USER NUTRITION PROFILE:
${nutritionContext.combinedBlock || "(standard healthy adult — no active protocols)"}

BUFFET FOODS AVAILABLE:
${foodsBlock}

Build the best plate for this user from the available foods. Respect all protocols strictly.`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 1200,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Buffet AI returned invalid JSON");
  }

  // ── Map AI response → AwayFromHomeRecommendation ────────────────────────────
  const buffetItems = (parsed.buffetItems as Array<{ food: string; portion: string; note?: string | null }> | undefined) ?? [];
  const cautionNotes = (parsed.cautionNotes as string[] | undefined) ?? [];

  const prioritize = (parsed.foodsToPrioritize as string[] | undefined) ?? [];
  const limitSkip  = (parsed.foodsToLimitOrSkip as string[] | undefined) ?? [];

  let howToOrderMods: string[] = [...limitSkip.map((f: string) => `Limit or skip: ${f}`)];
  if (parsed.dessertOrBeverageGuidance) {
    howToOrderMods.push(String(parsed.dessertOrBeverageGuidance));
  }
  if (parsed.secondChoicePlate) {
    howToOrderMods.push(`Second-choice plate: ${String(parsed.secondChoicePlate)}`);
  }

  const calories   = typeof parsed.estimatedCalories    === "number" ? parsed.estimatedCalories    : undefined;
  const protein    = typeof parsed.estimatedProteinGrams === "number" ? parsed.estimatedProteinGrams : undefined;
  const carbs      = typeof parsed.estimatedCarbGrams   === "number" ? parsed.estimatedCarbGrams   : undefined;
  const fat        = typeof parsed.estimatedFatGrams    === "number" ? parsed.estimatedFatGrams    : undefined;
  const calLow     = typeof parsed.caloriesLow          === "number" ? parsed.caloriesLow          : undefined;
  const calHigh    = typeof parsed.caloriesHigh         === "number" ? parsed.caloriesHigh         : undefined;

  const reasonParts: string[] = [];
  if (parsed.reason)            reasonParts.push(String(parsed.reason));
  if (prioritize.length > 0)    reasonParts.push(`Prioritize: ${prioritize.join(", ")}.`);
  if (parsed.medicalGuidance)   reasonParts.push(String(parsed.medicalGuidance));

  const recommendation: AwayFromHomeRecommendation = {
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
      ...(calLow != null && calHigh != null
        ? { caloriesRange: { low: calLow, high: calHigh } }
        : {}),
    },
    recommendation: {
      reason: reasonParts.join(" "),
      portionGuidance: parsed.portionGuidance ? String(parsed.portionGuidance) : undefined,
      howToOrder: {
        askFor: "Build Your Plate",
        modify: howToOrderMods,
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

  return recommendation;
}
