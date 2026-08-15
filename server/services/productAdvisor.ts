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
import { buildGroceryCoachContext, type GroceryCoachContext } from "./groceryCoachContext";

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

// ─── Swap (Replace) selection types ───────────────────────────────────────────
// Mode 3 — Replace: "Swap ONE item in an existing meal for something in-role."
// The Replace surface keeps its own intent/constraints (nutritional-role lock,
// meal context, variety requirement) — those are passed here as PARAMETERS so
// the brand/product selection logic lives in ONE engine shared with Find a
// Product and meal-driven Smart Cart. Never rebuild this as a separate prompt.

export interface SwapSuggestion {
  item: string;
  quantity?: string;
  unit?: string;
  reason: string;
}

export interface SwapSelectionResult {
  coachSuggestion?: SwapSuggestion;
  alternatives?: SwapSuggestion[];
  savedOption?: SwapSuggestion | null;
  protocolNote?: string | null;
}

/** Replace-specific intent/constraints — parameters, not a new prompt. */
export interface SwapSelectionParams {
  ingredientToReplace: string;
  /** Human label of the locked nutritional role (e.g. "lean protein source"). */
  roleLabel: string;
  /** Secondary role hint derived from the shopping-list category, if any. */
  categoryHint?: string | null;
  mealName?: string;
  mealDescription?: string;
  remainingIngredients?: string[];
  /** Free-text replacement the user asked for, if any. */
  userRequest?: string;
  /** Optional language instruction prepended to the system prompt. */
  languageInstruction?: string;
}

/**
 * Shared personalization for swap selection. Built from
 * buildGroceryCoachContext() — the single personalization source for all
 * Grocery Coach product surfaces (Find a Product, Replace, meal-driven cart).
 */
export interface SwapPersonalizationContext {
  protocolContext: string;
  macroContext: string;
  savedGroceriesBlock: string;
  savedProductNames: string[];
  glp1ConstraintBlock: string;
  diabeticConstraintBlock: string;
}

// ─── Brand Knowledge Provider (abstraction layer) ─────────────────────────────
// Today: GPT-4o. Tomorrow: Open Food Facts, USDA, retail APIs — nothing above changes.

export interface BrandKnowledgeProvider {
  getCartRecommendations(
    ingredients: string[],
    protocolContext: string,
    store?: string,
  ): Promise<CartRecommendationResult>;

  getSwapRecommendation(
    params: SwapSelectionParams,
    context: SwapPersonalizationContext,
  ): Promise<SwapSelectionResult>;
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

  async getSwapRecommendation(
    params: SwapSelectionParams,
    context: SwapPersonalizationContext,
  ): Promise<SwapSelectionResult> {
    const {
      ingredientToReplace, roleLabel, categoryHint,
      mealName, mealDescription, remainingIngredients, userRequest,
      languageInstruction,
    } = params;

    const remainingNote =
      remainingIngredients && remainingIngredients.length > 0
        ? `Other items already in the grocery list for this meal: ${remainingIngredients.join(", ")}.`
        : "";

    const userRequestNote = userRequest
      ? `The user specifically wants: "${userRequest}" — use this as coachSuggestion if it is safe, stays in-role, and meets all constraints. Otherwise suggest the closest compliant in-role option and note the reason in protocolNote.`
      : "";

    const systemPrompt = `You are a Grocery Store Coach. The user wants to replace one grocery item while keeping their meal intact.

MEAL: "${mealName || "current meal"}"${mealDescription ? ` — ${mealDescription}` : ""}
ITEM TO REPLACE: "${ingredientToReplace}"
${remainingNote}

NUTRITIONAL ROLE LOCK: "${ingredientToReplace}" is a ${roleLabel}.${categoryHint ? ` The item's grocery category confirms it is a ${categoryHint} — use this as a tiebreaker when the role is ambiguous.` : ""} ALL three suggestions (coachSuggestion + both alternatives) MUST stay within this exact nutritional role. Do not cross roles — no swapping a protein for a starch, a fat for a vegetable, etc. If the user's request would cross a role boundary or violate a clinical constraint, return the best in-role compliant alternative instead.

USER HEALTH PROFILE:
${context.protocolContext || "No dietary restrictions on file — apply general healthy eating principles."}
${context.glp1ConstraintBlock}${context.diabeticConstraintBlock}${context.macroContext ? `\n${context.macroContext}\n` : ""}${context.savedGroceriesBlock ? `\n${context.savedGroceriesBlock}\n` : ""}${
  context.savedProductNames.length > 0
    ? `\nUser's saved products (use one as savedOption if it fits the role and ALL constraints): ${context.savedProductNames.join(", ")}\n`
    : ""
}${userRequestNote ? `\n${userRequestNote}\n` : ""}
VARIETY REQUIREMENT: coachSuggestion and the two alternatives must be GENUINELY DIFFERENT choices — different ingredients, not cosmetic variations. For example, if replacing a chicken breast: give turkey, shrimp, and cod — not "organic chicken breast", "grilled chicken", "thin-sliced chicken". Give choices a user would clearly perceive as meaningfully different options.

RULES:
- All items must be real grocery-store purchases with realistic quantities (e.g. "2 lbs", "1 bunch", "1 can").
- If a specific branded product is the right pick, name a REAL, nationally available brand (stocked at Walmart, Target, Costco, Whole Foods, or major grocery chains) — the same brand standard used across all product advice in this app.
- Never suggest "${ingredientToReplace}" itself or any trivial variation of it.
- Never suggest items that conflict with allergies, avoidances, or clinical constraints.
- savedOption must come ONLY from the user's saved products list above (null if none qualify or list is empty).
- protocolNote: 1 sentence if a clinical constraint directly shaped the picks, otherwise null.

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "coachSuggestion": { "item": "string", "quantity": "string", "unit": "string", "reason": "string — 1 sentence why this fits this meal and this user's goals" },
  "alternatives": [
    { "item": "string", "quantity": "string", "unit": "string", "reason": "string — 1 sentence" },
    { "item": "string", "quantity": "string", "unit": "string", "reason": "string — 1 sentence" }
  ],
  "savedOption": { "item": "string", "quantity": "string", "unit": "string", "reason": "string — mention it is from their saved products" } | null,
  "protocolNote": "string" | null
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: languageInstruction ? `${languageInstruction}\n\n${systemPrompt}` : systemPrompt,
        },
        {
          role: "user",
          content: userRequest
            ? `Replace "${ingredientToReplace}" — I was thinking of "${userRequest}".`
            : `What should I replace "${ingredientToReplace}" with?`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as SwapSelectionResult;
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
    // buildGroceryCoachContext is the SHARED personalization source for all
    // Grocery Coach product surfaces (Find a Product, Replace, meal-driven
    // Smart Cart) — never rebuild protocol context from the raw envelope here.
    const ctx = await buildGroceryCoachContext(userId);
    const protocolContext = buildProtocolContextString(ctx);

    return this.provider.getCartRecommendations(ingredients, protocolContext, store);
  }

  /**
   * Mode 3 — Replace: swap ONE grocery item while keeping the meal intact.
   * The caller supplies the already-built GroceryCoachContext (avoids a second
   * DB round-trip) plus the Replace-specific intent/constraints as parameters.
   */
  async buildSwapRecommendation(
    ctx: GroceryCoachContext,
    params: SwapSelectionParams,
  ): Promise<SwapSelectionResult> {
    return this.provider.getSwapRecommendation(params, buildSwapPersonalization(ctx));
  }
}

/** Personalization string shared by cart-style advice, from the shared context. */
function buildProtocolContextString(ctx: GroceryCoachContext): string {
  const parts: string[] = [];
  if (ctx.protocolContext) parts.push(ctx.protocolContext);
  if (ctx.glp1RecommendationBlock) parts.push(ctx.glp1RecommendationBlock);
  if (ctx.macroContext) parts.push(ctx.macroContext);
  if (ctx.savedGroceriesBlock) parts.push(ctx.savedGroceriesBlock);
  return parts.length
    ? parts.join("\n")
    : "No specific dietary or medical constraints on file — apply general healthy eating principles.";
}

/** Derive the swap personalization block set from the shared context. */
export function buildSwapPersonalization(ctx: GroceryCoachContext): SwapPersonalizationContext {
  const glp1ConstraintBlock = ctx.glp1Targets
    ? `GLP-1 CONSTRAINT: All suggestions MUST have ≤${ctx.glp1Targets.maximumToleratedFatGrams}g fat per serving and ≤${ctx.glp1Targets.resolvedMealCalories} kcal. No fatty meats, oils, full-fat dairy, fried items, or avocado.\n`
    : "";
  const diabeticConstraintBlock = ctx.hasDiabetes
    ? `DIABETIC CONSTRAINT: All suggestions MUST be low-carb. No bread, rice, pasta, potatoes, corn, or sugary sauces. Prefer non-starchy vegetables, lean proteins, or legumes.\n`
    : "";

  return {
    protocolContext: ctx.protocolContext,
    macroContext: ctx.macroContext,
    savedGroceriesBlock: ctx.savedGroceriesBlock,
    savedProductNames: ctx.savedRows
      .map((r) => r.productName)
      .filter((n): n is string => Boolean(n)),
    glp1ConstraintBlock,
    diabeticConstraintBlock,
  };
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
