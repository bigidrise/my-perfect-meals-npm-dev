/**
 * MealRefinementEngine
 *
 * Universal service for refining an existing meal recommendation. Any endpoint
 * that needs to swap, adjust, or re-roll part of a generated meal should go
 * through this engine rather than duplicating the protocol-loading + LLM call
 * pattern. This keeps clinical logic in one place so new conditions (oncology,
 * ARFID, etc.) added to the protocol envelope are automatically inherited.
 *
 * Phase 1: "replace_ingredient" — ingredient swap for Grocery Coach.
 */

import OpenAI from "openai";
import { db } from "../db";
import { userSavedGroceryItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  loadUserProtocolEnvelope,
  buildGuestEnvelope,
  enforceBeforeGenerate,
  scanGeneratedOutput,
  type UserProtocolEnvelope,
} from "./protocolEnvelope";
import {
  resolveGLP1GlobalContext,
  buildGLP1RecommendationBlock,
} from "./glp1/resolveGLP1GlobalContext";
import type { ResolvedGLP1Targets } from "./glp1/resolveGLP1MealTargets";
import {
  filterSavedGroceriesForCompliance,
  buildSavedGroceriesPromptBlock,
} from "./savedGroceryCompliance";

// ── Public types ──────────────────────────────────────────────────────────────

export type RefinementChangeType = "replace_ingredient";

export interface ReplaceIngredientRequest {
  changeType: "replace_ingredient";
  /** ID of the authenticated user requesting the refinement. */
  userId: string;
  /** The ingredient name to replace (as it appears in the meal). */
  ingredientToReplace: string;
  /** Name of the meal being refined — adds context for the LLM. */
  mealName?: string;
  /** Short description of the meal. */
  mealDescription?: string;
  /** Other ingredients in the meal that must be preserved. */
  remainingIngredients?: string[];
  /**
   * Optional explicit swap target from the user (e.g. "something with less
   * sodium"). The engine evaluates it first; if clinically safe, it becomes
   * the coachSuggestion.
   */
  userRequest?: string;
}

export type RefinementRequest = ReplaceIngredientRequest;

export interface SwapSuggestion {
  item: string;
  reason: string;
  quantity: string;
  unit: string;
}

export interface SwapAlternative {
  item: string;
  reason: string;
}

/** Returned by the engine for a "replace_ingredient" refinement. */
export interface SwapRefinementResult {
  coachSuggestion: SwapSuggestion;
  savedOption: { item: string; reason: string } | null;
  alternatives: SwapAlternative[];
  protocolNote: string | null;
}

export type RefinementResult = SwapRefinementResult;

// ── Engine ────────────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export class MealRefinementEngine {
  /**
   * Refine an existing meal recommendation. Internally loads the full clinical
   * protocol envelope (5-tier constraints), GLP-1 context, and compliant saved
   * grocery favourites for the user — then delegates to the appropriate
   * LLM handler based on `changeType`.
   */
  async refine(request: RefinementRequest): Promise<RefinementResult> {
    switch (request.changeType) {
      case "replace_ingredient":
        return this._replaceIngredient(request);
      default: {
        throw new Error(`Unsupported refinement changeType: ${(request as any).changeType}`);
      }
    }
  }

  // ── replace_ingredient ────────────────────────────────────────────────────

  private async _replaceIngredient(req: ReplaceIngredientRequest): Promise<SwapRefinementResult> {
    const { userId, ingredientToReplace, mealName, mealDescription, remainingIngredients, userRequest } = req;

    // ── 1. Protocol envelope ──────────────────────────────────────────────────
    let envelope: UserProtocolEnvelope = buildGuestEnvelope();
    let protocolContext = "";
    try {
      envelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
      protocolContext = enforceBeforeGenerate(envelope, { generatorName: "grocery_swap" }).combined;
    } catch {
      // Proceed without protocol context rather than blocking the swap.
    }

    // ── 2. GLP-1 context ──────────────────────────────────────────────────────
    let glp1Block = "";
    let glp1Targets: ResolvedGLP1Targets | null = null;
    try {
      const todayISO = new Date().toISOString().slice(0, 10);
      const glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
      if (glp1Ctx) {
        glp1Block = buildGLP1RecommendationBlock(glp1Ctx);
        glp1Targets = glp1Ctx.resolvedTargets ?? null;
      }
    } catch {
      // Non-fatal for swap — proceed without GLP-1 overlay.
    }

    // ── 3. Saved groceries ────────────────────────────────────────────────────
    let savedBlock = "";
    try {
      const sgRows = await db
        .select({
          id: userSavedGroceryItems.id,
          productName: userSavedGroceryItems.productName,
          brand: userSavedGroceryItems.brand,
          category: userSavedGroceryItems.category,
          productKey: userSavedGroceryItems.productKey,
          nutritionJson: userSavedGroceryItems.nutritionJson,
          savedAt: userSavedGroceryItems.savedAt,
        })
        .from(userSavedGroceryItems)
        .where(eq(userSavedGroceryItems.userId, userId));

      if (sgRows.length > 0) {
        const { compliant } = filterSavedGroceriesForCompliance(
          sgRows as any,
          envelope,
          { glp1Targets, isDiabetic: envelope.hasDiabetes },
        );
        savedBlock = buildSavedGroceriesPromptBlock(compliant);
      }
    } catch {
      // Non-fatal — proceed without saved grocery context.
    }

    // ── 4. Build system prompt ────────────────────────────────────────────────
    const remaining =
      Array.isArray(remainingIngredients) && remainingIngredients.length > 0
        ? remainingIngredients.join(", ")
        : "the other meal ingredients";

    const systemPrompt = `You are a Grocery Store Coach. A user wants to replace ONE ingredient in their planned meal while keeping everything else.

USER HEALTH PROFILE:
${protocolContext || "No dietary restrictions on file — apply general healthy eating principles."}
${glp1Block ? `\n${glp1Block}` : ""}
${savedBlock ? `\n\n${savedBlock}` : ""}

MEAL CONTEXT:
Meal: ${mealName || "current meal"}${mealDescription ? `\nDescription: ${mealDescription}` : ""}
Keeping these ingredients: ${remaining}

TASK: Replace "${ingredientToReplace}"${
      userRequest
        ? ` — the user specifically wants: "${userRequest}" (evaluate this first; if it is clinically safe and fits the meal, make it the coachSuggestion)`
        : ""
    }.

Rules:
- NEVER suggest "${ingredientToReplace}" or any variation of it
- NEVER suggest anything that violates the user's allergies or hard dietary rules  
- coachSuggestion must be the single best replacement — practical, grocery-store-ready, fits the meal style and the protocol
- alternatives: 1–2 different valid options (must differ from coachSuggestion)
- savedOption: set this ONLY if one of the user's saved groceries (listed above as user favorites) would work as a valid, compliant replacement — otherwise null
- protocolNote: short clinical note only when genuinely relevant, otherwise null
- quantity: realistic for a home meal; unit: common grocery unit (cups, oz, lbs, bunch, etc.)

Respond ONLY with valid JSON:
{
  "coachSuggestion": { "item": "string", "reason": "string — 1-2 sentences", "quantity": "string", "unit": "string" },
  "savedOption": { "item": "string", "reason": "string — mention it's from their saved products" } | null,
  "alternatives": [{ "item": "string", "reason": "string" }],
  "protocolNote": "string | null"
}`;

    // ── 5. LLM call ───────────────────────────────────────────────────────────
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: userRequest
            ? `Replace ${ingredientToReplace} with ${userRequest}`
            : `Find the best replacement for ${ingredientToReplace}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let swapData: any;
    try {
      swapData = JSON.parse(raw);
    } catch {
      throw new Error("Could not parse swap response from LLM.");
    }

    if (!swapData.coachSuggestion?.item) {
      throw new Error("Swap response missing coachSuggestion.");
    }

    // ── 6. Protocol scan on the suggestion ───────────────────────────────────
    // Non-fatal: appends a protocolNote warning rather than blocking.
    try {
      const scan = scanGeneratedOutput(
        {
          name: `Swap: ${swapData.coachSuggestion.item}`,
          ingredients: [{ name: swapData.coachSuggestion.item }],
        },
        envelope,
        { generatorName: "grocery_swap", skipAdaptableConflicts: true },
      );
      if (!scan.passed) {
        const existing = swapData.protocolNote ? `${swapData.protocolNote} ` : "";
        swapData.protocolNote =
          `${existing}Note: "${swapData.coachSuggestion.item}" may conflict with your protocol — ${scan.message}. Review before adding.`;
      }
    } catch {
      // Scan errors are non-fatal for ingredient swap.
    }

    return {
      coachSuggestion: swapData.coachSuggestion,
      savedOption: swapData.savedOption ?? null,
      alternatives: Array.isArray(swapData.alternatives) ? swapData.alternatives : [],
      protocolNote: swapData.protocolNote ?? null,
    };
  }
}

/** Singleton — re-use across requests to avoid re-initialising the OpenAI client. */
let _engine: MealRefinementEngine | null = null;
export function getMealRefinementEngine(): MealRefinementEngine {
  if (!_engine) _engine = new MealRefinementEngine();
  return _engine;
}
