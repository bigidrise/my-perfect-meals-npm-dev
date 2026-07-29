/**
 * Menu-Item AI Recommender
 *
 * Phase 2 of the Meals Away From Home platform.
 *
 * Given VERIFIED menu items from the RestaurantIntelligenceEngine, this service
 * asks the AI to SELECT the best options for the user — never to invent new items.
 *
 * Contract:
 *   - Input:  NormalizedMenuItem[] from engine (real, verified data)
 *   - Output: AwayFromHomeRecommendation[] with macros from the real items
 *   - AI role: selector + reason-giver, NOT inventor
 *
 * If the AI returns an itemId that isn't in the list, it is silently dropped.
 * A valid response always has at least 1 recommendation.
 * If the AI returns 0 valid selections, the caller receives an empty array
 * and the route must NOT fall back to menu invention.
 */

import OpenAI from "openai";
import type {
  NormalizedMenuItem,
  AwayFromHomeRecommendation,
  NutritionDataStatus,
  MenuSource,
  RestaurantIdentity,
} from "@shared/awayFromHome";
import { getNutritionDisclosure } from "@shared/awayFromHome";
import { buildDietPromptBlock, getPrimaryDiet } from "../allergyGuardrails";
import type { UserProtocolEnvelope } from "../protocolEnvelope";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ── Request shape ─────────────────────────────────────────────────────────────

export interface GenerateFromMenuItemsRequest {
  restaurantName: string;
  restaurantIdentity: RestaurantIdentity;
  restaurantInfo: {
    name: string;
    address?: string;
    rating?: number;
    photoUrl?: string;
  };
  menuItems: NormalizedMenuItem[];
  menuSource: MenuSource;
  menuLastVerifiedAt: string;
  craving?: string;
  user?: any;
  protocolBlock?: string;
  protocolEnvelope?: UserProtocolEnvelope;
  builderBlock?: string;
}

// ── AI selection schema ────────────────────────────────────────────────────────

interface AIItemSelection {
  itemId: string;
  reason: string;
  modifications?: string;
  howToOrder?: {
    askFor: string;
    modify: string[];
    swap: string[];
  };
  medicalWaiterScript?: string;
}

interface AISelectionResponse {
  recommendations: AIItemSelection[];
}

// ── Menu item formatter ───────────────────────────────────────────────────────

function formatMenuItemsForPrompt(items: NormalizedMenuItem[]): string {
  return items
    .map((item, i) => {
      const dietFlags = [
        item.isVegan ? "✓ Vegan" : null,
        item.isVegetarian && !item.isVegan ? "✓ Vegetarian" : null,
        item.isGlutenFree ? "✓ Gluten-free" : null,
      ]
        .filter(Boolean)
        .join("  ");

      const allergenLine =
        item.allergens && item.allergens.length > 0
          ? `Allergens: ${item.allergens.join(", ")}`
          : "Allergens: none declared";

      const customLine =
        item.customizationOptions && item.customizationOptions.length > 0
          ? `Can customize: ${item.customizationOptions.join(", ")}`
          : "";

      return [
        `${i + 1}. [${item.id}] ${item.name}`,
        `   ${item.description || ""}`,
        `   ${item.calories} kcal | Protein: ${item.proteinGrams}g | Carbs: ${item.carbohydrateGrams}g | Fat: ${item.fatGrams}g${item.fiberGrams != null ? ` | Fiber: ${item.fiberGrams}g` : ""}`,
        `   ${allergenLine}`,
        customLine ? `   ${customLine}` : null,
        dietFlags ? `   ${dietFlags}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

// ── Nutrition status resolver ─────────────────────────────────────────────────

function resolveNutritionStatus(
  source: MenuSource,
  hasUserSubstitutions: boolean
): NutritionDataStatus {
  if (source === "internal_canonical" || source === "licensed_api") {
    return hasUserSubstitutions ? "mixed" : "official";
  }
  return "estimated";
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function generateMenuItemRecommendations(
  request: GenerateFromMenuItemsRequest
): Promise<AwayFromHomeRecommendation[]> {
  const {
    restaurantName,
    restaurantIdentity,
    restaurantInfo,
    menuItems,
    menuSource,
    menuLastVerifiedAt,
    craving,
    user,
    protocolBlock,
    builderBlock,
  } = request;

  if (menuItems.length === 0) {
    console.warn(`⚠️ [MenuRec] generateMenuItemRecommendations called with 0 items for "${restaurantName}"`);
    return [];
  }

  console.log(
    `🤖 [MenuRec] Selecting from ${menuItems.length} verified items at "${restaurantName}"` +
      (craving ? ` — craving: "${craving}"` : "")
  );

  // ── Build context blocks ────────────────────────────────────────────────────

  const userDietaryRestrictions: string[] = user?.dietaryRestrictions || [];
  const userAllergies: string[] = user?.allergies || [];
  const userConditions: string[] = user?.healthConditions || [];

  const dietBlock = buildDietPromptBlock(userDietaryRestrictions);
  const primaryDiet = getPrimaryDiet(userDietaryRestrictions);

  const allergyLine =
    userAllergies.length > 0
      ? `\nALLERGY SAFETY (CRITICAL): User is allergic to: ${userAllergies.join(", ")}. NEVER select items with these allergens.`
      : "";

  const dietLine = dietBlock
    ? `\nDIET CONSTRAINT:\n${dietBlock}`
    : userDietaryRestrictions.length > 0
      ? `\nDiet: ${userDietaryRestrictions.join(", ")} — filter accordingly.`
      : "";

  const medicalLine =
    userConditions.length > 0
      ? `\nMEDICAL CONDITIONS: ${userConditions.join(", ")} — prioritize items that support these conditions and generate a medicalWaiterScript if needed.`
      : "";

  const protocolSection = protocolBlock
    ? `\n\n=== NUTRITION PROTOCOL ===\n${protocolBlock}`
    : "";

  const builderSection = builderBlock
    ? `\n\n=== ACTIVE MEAL BUILDER GUIDANCE ===\n${builderBlock}`
    : "";

  const cravingLine = craving
    ? `\nUser craving: "${craving}" — select items that best satisfy this.`
    : "";

  // ── Build system prompt ─────────────────────────────────────────────────────

  const systemPrompt = `You are a clinical nutrition advisor helping a user choose the healthiest options from a REAL, VERIFIED restaurant menu.

CRITICAL RULE: You MUST select ONLY from the exact items listed below. You CANNOT invent, create, or combine items that are not on this list. Every itemId in your response must exactly match an id from the list.

Restaurant: ${restaurantIdentity.displayName}${cravingLine}${allergyLine}${dietLine}${medicalLine}${protocolSection}${builderSection}

=== VERIFIED MENU ITEMS (select from ONLY these) ===

${formatMenuItemsForPrompt(menuItems)}

=== YOUR TASK ===

Select 3–5 items that best fit the user's craving and health profile. For each item:

- reason: Why this item fits the user's goals (1–2 sentences, health-focused)
- modifications: What to change at ordering time ("Order as-is" if no changes needed)
- howToOrder.askFor: The item name + key modification in one phrase
- howToOrder.modify: Array of specific modifications to request from staff (e.g., ["grilled not fried", "sauce on the side"])
- howToOrder.swap: Array of swaps (e.g., ["fries → side salad"]) — empty array if none
- medicalWaiterScript: ONLY include if user has medical conditions — a natural-language sentence the user says out loud to their server. Omit this field entirely if no conditions.

${primaryDiet === "vegan" ? "VEGAN: Only select items with isVegan=true. If none are available, say so in modifications.\n" : ""}${primaryDiet === "vegetarian" ? "VEGETARIAN: Only select items marked Vegetarian or Vegan.\n" : ""}

Return ONLY valid JSON — no commentary, no markdown fences:

{
  "recommendations": [
    {
      "itemId": "exact_id_from_list",
      "reason": "...",
      "modifications": "...",
      "howToOrder": {
        "askFor": "...",
        "modify": ["..."],
        "swap": ["..."]
      }
    }
  ]
}`;

  // ── Call AI ────────────────────────────────────────────────────────────────

  let aiResponse: AISelectionResponse;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: systemPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    aiResponse = JSON.parse(raw) as AISelectionResponse;
  } catch (err) {
    console.error(`❌ [MenuRec] AI call failed for "${restaurantName}":`, err);
    return [];
  }

  if (!Array.isArray(aiResponse.recommendations)) {
    console.warn(`⚠️ [MenuRec] AI returned no recommendations array for "${restaurantName}"`);
    return [];
  }

  // ── Map AI selections back to real menu items ──────────────────────────────

  const itemById = new Map(menuItems.map((item) => [item.id, item]));

  const recommendations: AwayFromHomeRecommendation[] = [];

  for (const sel of aiResponse.recommendations) {
    const item = itemById.get(sel.itemId);
    if (!item) {
      console.warn(`⚠️ [MenuRec] AI returned unknown itemId "${sel.itemId}" — dropped`);
      continue;
    }

    const hasSubstitutions = !!(sel.howToOrder?.swap && sel.howToOrder.swap.length > 0);
    const nutritionStatus = resolveNutritionStatus(menuSource, hasSubstitutions);

    const rec: AwayFromHomeRecommendation = {
      id: `${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: "restaurant_guide",

      restaurantName: restaurantInfo.name,
      restaurantAddress: restaurantInfo.address,
      restaurantRating: restaurantInfo.rating,
      restaurantPhotoUrl: restaurantInfo.photoUrl,
      restaurantCuisine: restaurantIdentity.cuisineType,

      nutritionStatus,
      menuSourceDisclosure: getNutritionDisclosure(nutritionStatus),

      meal: {
        name: item.name,
        description: item.description,
        category: item.category,
        calories: item.calories,
        proteinGrams: item.proteinGrams,
        carbohydrateGrams: item.carbohydrateGrams,
        fatGrams: item.fatGrams,
        ingredients: [],
      },

      recommendation: {
        reason: sel.reason,
        modifications: sel.modifications,
        howToOrder: sel.howToOrder,
        medicalWaiterScript: sel.medicalWaiterScript,
      },

      protocol: {
        badges: [],
      },
    };

    recommendations.push(rec);
  }

  console.log(
    `✅ [MenuRec] ${recommendations.length}/${aiResponse.recommendations.length} selections mapped to real items for "${restaurantName}"`
  );

  return recommendations;
}
