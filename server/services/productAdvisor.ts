/**
 * Product Advisor Engine
 *
 * A first-class product intelligence engine with two modes:
 *
 * Mode 1 — Reactive (Smart Scan):  "Is THIS product good for me?"
 * Mode 2 — Proactive (Shopping Advisor): "What exact products should I buy?"
 *
 * Architecture is provider-based so the brand knowledge layer can be swapped
 * from GPT-4o today to Open Food Facts, USDA, or a retail API tomorrow without
 * changing any consumer code above this layer.
 */

import { openai } from "../utils/openaiSafe";
import { loadUserProtocolEnvelope } from "./protocolEnvelope";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandRecommendation {
  brand: string;
  rank: 1 | 2 | 3;
  grade: "A" | "B" | "C";
  reason: string;
}

export interface AvoidRecommendation {
  brand: string;
  reason: string;
}

export interface IngredientAdvice {
  ingredient: string;
  category: string;
  recommended: BrandRecommendation[];
  avoid: AvoidRecommendation[];
}

export interface CartRecommendationResult {
  advice: IngredientAdvice[];
  profileUsed: string[];
  store?: string;
}

// ─── Brand Knowledge Provider (abstraction layer) ─────────────────────────────
// Today: GPT-4o. Tomorrow: Open Food Facts, USDA, retail APIs — nothing above changes.

export interface BrandKnowledgeProvider {
  getCartRecommendations(
    ingredients: string[],
    protocolContext: string,
    store?: string,
  ): Promise<CartRecommendationResult>;
}

// ─── GPT-4o Brand Knowledge Provider ─────────────────────────────────────────

const SHOPPING_ADVISOR_SYSTEM_PROMPT = `You are a Product Advisor for a personalized nutrition app. Your job is to recommend specific, real grocery brands for packaged ingredients based on a user's exact health profile.

CORE RULES:
- Only advise on packaged/branded items that have meaningful brand variation: sauces, broths, pasta, canned goods, cheese, oils, grains, condiments, dressings, protein powders, snacks, cereals, etc.
- SKIP fresh produce (broccoli, spinach, berries), whole unpackaged meats (raw chicken breast, steak), fresh herbs, and eggs — return nothing for those.
- Recommend 2–3 REAL, nationally available brands per ingredient (stocked at Walmart, Target, Costco, Whole Foods, or major grocery chains).
- The rank-1 brand is your top pick. Rank 2 and 3 are good alternatives.
- Every "reason" MUST directly reference the user's specific condition by name (e.g. "for your cardiac protocol", "given your renal diet", "for your anti-inflammatory protocol"). Generic health claims are not allowed.
- Only flag brands in "avoid" if they are GENUINELY problematic for this user's specific protocol — not merely "unhealthy in general."
- Avoid brands in "avoid" should be COMMON brands the user might reach for by default (not obscure ones).
- If the user has no specific conditions, focus on ingredient quality and macros relevant to their fitness goal.
- Grade rubric: A = strong alignment, B = acceptable with minor notes, C = use with caution given their protocol.

RESPONSE FORMAT — strict JSON only, no markdown:
{
  "advice": [
    {
      "ingredient": "Marinara Sauce",
      "category": "Sauce",
      "recommended": [
        { "brand": "Rao's Marinara", "rank": 1, "grade": "A", "reason": "Low sodium and zero seed oils — ideal for your cardiac and anti-inflammatory protocols" },
        { "brand": "Victoria Marinara", "rank": 2, "grade": "A", "reason": "Clean ingredient list, sodium level fits your cardiac limit" },
        { "brand": "Yo Mama's Marinara", "rank": 3, "grade": "B", "reason": "Good alternative — slightly higher sodium but within range for your cardiac protocol" }
      ],
      "avoid": [
        { "brand": "Ragú Traditional", "reason": "High sodium and soybean oil — conflicts with your cardiac protocol and anti-inflammatory goals" }
      ]
    }
  ],
  "profileUsed": ["Cardiac Protocol", "Anti-Inflammatory"]
}

profileUsed: short label strings listing only the conditions that genuinely drove the recommendations. Examples: "Cardiac Protocol", "Anti-Inflammatory", "Renal Protocol", "GLP-1 Protocol", "Vegan Diet", "Gluten-Free", "Blood Glucose Control", "Weight Loss Goal", "Hashimoto's Support".`;

class GptBrandKnowledgeProvider implements BrandKnowledgeProvider {
  async getCartRecommendations(
    ingredients: string[],
    protocolContext: string,
    store?: string,
  ): Promise<CartRecommendationResult> {
    const storeNote = store
      ? `\n\nThe user is shopping at: ${store}. Prioritize brands available at that store when possible.`
      : "";

    const userMessage = `USER HEALTH PROFILE:
${protocolContext}${storeNote}

SHOPPING LIST — provide brand advice for any packaged items below:
${ingredients.map((i, n) => `${n + 1}. ${i}`).join("\n")}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SHOPPING_ADVISOR_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 2400,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    return {
      advice: (parsed.advice ?? []) as IngredientAdvice[],
      profileUsed: (parsed.profileUsed ?? []) as string[],
      store,
    };
  }
}

// ─── Product Advisor Engine ───────────────────────────────────────────────────

export class ProductAdvisorEngine {
  constructor(private readonly provider: BrandKnowledgeProvider) {}

  async buildCartRecommendations(
    userId: string,
    ingredients: string[],
    store?: string,
  ): Promise<CartRecommendationResult> {
    const envelope = await loadUserProtocolEnvelope(userId);

    const contextParts: string[] = [];

    if (envelope) {
      if ((envelope as any).dietaryIdentity?.primary) {
        contextParts.push(`Dietary identity: ${(envelope as any).dietaryIdentity.primary}`);
      } else if ((envelope as any).dietaryIdentity?.length) {
        contextParts.push(`Dietary identity: ${(envelope as any).dietaryIdentity.join(", ")}`);
      }

      const allergies = (envelope as any).allergies?.hardBlocked
        ?? (envelope as any).allergies ?? [];
      if (allergies.length) {
        contextParts.push(`Allergies / hard stops: ${allergies.join(", ")}`);
      }

      const conditions = (envelope as any).medicalHardLimits?.conditions
        ?? (envelope as any).medicalHardLimits ?? [];
      if (conditions.length) {
        contextParts.push(`Medical conditions: ${conditions.join(", ")}`);
      }

      const avoidances = (envelope as any).avoidances?.foods
        ?? (envelope as any).avoidances ?? [];
      if (avoidances.length) {
        contextParts.push(`Foods user avoids: ${(avoidances as string[]).slice(0, 8).join(", ")}`);
      }

      const fitnessGoal = (envelope as any).preferences?.fitnessGoal
        ?? (envelope as any).fitnessGoal;
      if (fitnessGoal) {
        contextParts.push(`Fitness goal: ${fitnessGoal}`);
      }

      const guidanceBlocks: string[] = (envelope as any).conditionGuidanceBlocks ?? [];
      if (guidanceBlocks.length) {
        contextParts.push(
          "=== CLINICAL PROTOCOLS — ENFORCE IN ALL RECOMMENDATIONS ===\n" +
          guidanceBlocks.join("\n\n"),
        );
      }
    }

    const protocolContext = contextParts.length
      ? contextParts.join("\n")
      : "No specific dietary or medical constraints on file — apply general healthy eating principles.";

    return this.provider.getCartRecommendations(ingredients, protocolContext, store);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// Shared instance — provider can be swapped via setProvider() when a better
// brand knowledge source becomes available without touching any consumer code.

let _provider: BrandKnowledgeProvider = new GptBrandKnowledgeProvider();
let _engine: ProductAdvisorEngine = new ProductAdvisorEngine(_provider);

export function setProductAdvisorProvider(provider: BrandKnowledgeProvider): void {
  _provider = provider;
  _engine = new ProductAdvisorEngine(_provider);
}

export function getProductAdvisorEngine(): ProductAdvisorEngine {
  return _engine;
}
