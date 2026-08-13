/**
 * mealRefinementEngine.ts
 *
 * Universal service for refining an existing meal recommendation. Any endpoint
 * that needs to swap, adjust, or re-roll part of a generated meal should go
 * through this engine rather than duplicating the protocol-loading + LLM call
 * pattern. This keeps clinical logic in one place so new conditions (oncology,
 * ARFID, etc.) added to the protocol envelope are automatically inherited.
 *
 * Phase 1: "replace_ingredient" — ingredient swap for Grocery Coach.
 * Phase 2: "adjust_macros"      — macro-target adjustment (e.g. "more protein").
 *          "change_cooking_method" — cooking-method rewrite (e.g. "air-fryer friendly").
 *
 * Also exports refineMeal() (function API) for callers that need the full
 * existingMeal + changeInstruction + retry + NDE scan pipeline directly.
 *
 * CLINICAL GUARANTEES:
 *   • GLP-1 FAIL-CLOSED — if the resolver throws or returns active with no targets,
 *     the engine throws MealRefinementRetryableError (surfaces as 503).
 *   • GLP-1 MACROS — absent/non-finite macros on a GLP-1 meal are treated as a
 *     violation (cannot verify compliance = fail closed).
 *   • DIABETIC STARCH GATE — starchBudgetViolation.detected triggers remediation,
 *     not a warning. Both initial and retry outputs are gated.
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
  type ProtocolScanResult,
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
export type RefinementChangeType =
  | "replace_ingredient"
  | "adjust_macros"
  | "change_cooking_method";

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

export interface AdjustMacrosRequest {
  changeType: "adjust_macros";
  /** ID of the authenticated user requesting the refinement. */
  userId: string;
  /**
   * Plain-language macro goal, e.g. "more protein", "lower carbs",
   * "reduce fat", "fewer calories".
   */
  macroGoal: string;
  /** Name of the meal being adjusted. */
  mealName?: string;
  /** Short description of the meal. */
  mealDescription?: string;
  /** Current ingredient list so the LLM can make targeted swaps. */
  currentIngredients?: string[];
  /** Current estimated macros for the meal (used to anchor the adjustment). */
  currentMacros?: { calories?: number; protein?: number; carbs?: number; fat?: number };
}
export type RefinementRequest =
  | ReplaceIngredientRequest
  | AdjustMacrosRequest
  | ChangeCookingMethodRequest;

// ── Result types ──────────────────────────────────────────────────────────────

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

export interface AdjustedIngredient {
  item: string;
  change: string;   // short description of what changed, e.g. "doubled portion"
  reason: string;
}
export type RefinementResult =
  | SwapRefinementResult
  | MacroAdjustmentResult
  | CookingMethodResult;

// ── Retryable error marker ────────────────────────────────────────────────────

/** Thrown when a clinical resolver is temporarily unavailable. Surface as 503. */
export class MealRefinementRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MealRefinementRetryableError";
  }
}

// ─── OpenAI singleton ─────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

/**
 * Lenient protocol context loader — used by _replaceIngredient.
 * Falls back to guest envelope / no GLP-1 context if any layer fails.
 * Callers that need clinical safety guarantees should use loadProtocolContextStrict.
 */
async function loadProtocolContext(userId: string): Promise<{
  envelope: UserProtocolEnvelope;
  protocolContext: string;
  glp1Block: string;
  glp1Targets: ResolvedGLP1Targets | null;
  savedBlock: string;
}> {
  // ── 1. Protocol envelope ────────────────────────────────────────────────────
  let envelope: UserProtocolEnvelope = buildGuestEnvelope();
  let protocolContext = "";
  try {
    envelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
    protocolContext = enforceBeforeGenerate(envelope, { generatorName: "meal_refinement" }).combined;
  } catch {
    // Proceed without protocol context.
  }

  // ── 2. GLP-1 context ────────────────────────────────────────────────────────
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
    // Non-fatal.
  }

  // ── 3. Saved groceries ──────────────────────────────────────────────────────
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
    // Non-fatal.
  }

  return { envelope, protocolContext, glp1Block, glp1Targets, savedBlock };
}

/**
 * Strict (fail-closed) protocol context loader — used by clinical handlers
 * (_adjustMacros, _changeCookingMethod).
 *
 * Throws rather than silently degrading so that a resolver failure never
 * causes these handlers to generate guidance without the correct clinical
 * context. The router's catch block converts the throw into a 500 response.
 */
async function loadProtocolContextStrict(userId: string): Promise<{
  envelope: UserProtocolEnvelope;
  protocolContext: string;
  glp1Block: string;
  glp1Targets: ResolvedGLP1Targets | null;
  savedBlock: string;
}> {
  // ── 1. Protocol envelope — required; throw on failure or null return ─────────
  let envelope: UserProtocolEnvelope;
  try {
    const loaded = await loadUserProtocolEnvelope(userId);
    if (!loaded) {
      throw new Error("Protocol envelope returned null.");
    }
    envelope = loaded;
  } catch (err: any) {
    throw new Error(
      `Clinical guidance temporarily unavailable — could not load dietary protocol. Please try again. (${err?.message})`,
    );
  }
  const protocolContext = enforceBeforeGenerate(envelope, { generatorName: "meal_refinement" }).combined;

  // ── 2. GLP-1 context — fail closed when resolver fails ────────────────────
  let glp1Block = "";
  let glp1Targets: ResolvedGLP1Targets | null = null;
  const todayISO = new Date().toISOString().slice(0, 10);
  const glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
  if (glp1Ctx === null) {
    throw new Error("Clinical guidance temporarily unavailable — GLP-1 resolver failed. Please try again.");
  }
  if (glp1Ctx.isActive && !glp1Ctx.resolvedTargets) {
    throw new Error("GLP-1 clinical targets temporarily unavailable. Please try again.");
  }
  glp1Block = buildGLP1RecommendationBlock(glp1Ctx);
  glp1Targets = glp1Ctx.resolvedTargets ?? null;

  // ── 3. Saved groceries — non-fatal even in strict mode ────────────────────
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
    // Saved-grocery context is not safety-critical — proceed without it.
  }

  return { envelope, protocolContext, glp1Block, glp1Targets, savedBlock };
}

/**
 * Recursively collects every string value in a JSON-like object/array into
 * one space-joined blob.  Used to build the full-text scan corpus from an LLM
 * response so that allergens or forbidden terms hidden in ANY field
 * (macroImpact.summary, protocolNote, cookingTips[].reason, etc.) are caught
 * — not just top-level ingredient names.
 */
function extractAllStrings(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractAllStrings).join(" ");
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(extractAllStrings)
      .join(" ");
  }
  return "";
}

/**
 * Canonical allergy taxonomy — maps standardized category labels (as they are
 * stored in the DB) to the specific ingredient members that should be blocked.
 * Keys are normalised to lowercase. Ingredient members use common forms so that
 * substring matching against generated text works reliably.
 *
 * Examples of how labels arrive: "Tree Nuts", "tree-nuts", "Shellfish",
 * "Dairy", "Peanuts", "Gluten", "Soy", "Eggs", "Sesame", "Fish", "Wheat".
 */
const ALLERGEN_TAXONOMY: Record<string, string[]> = {
  // Tree nuts ──────────────────────────────────────────────────────────────
  "tree nut":   ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut", "praline", "marzipan", "frangipane", "gianduja", "nougat"],
  "tree nuts":  ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut", "praline", "marzipan", "frangipane", "gianduja", "nougat"],
  "tree-nut":   ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut", "praline", "marzipan"],
  "tree-nuts":  ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut", "praline", "marzipan"],
  "nuts":       ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut", "praline", "marzipan"],
  "nut":        ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut"],
  // Peanuts (separate from tree nuts) ──────────────────────────────────────
  "peanut":     ["peanut", "groundnut", "arachis"],
  "peanuts":    ["peanut", "groundnut", "arachis"],
  "groundnut":  ["peanut", "groundnut", "arachis"],
  // Shellfish ───────────────────────────────────────────────────────────────
  "shellfish":  ["shrimp", "crab", "lobster", "crayfish", "crawfish", "prawn", "clam", "oyster", "scallop", "mussel", "squid", "octopus", "abalone", "barnacle", "langoustine"],
  // Fish ─────────────────────────────────────────────────────────────────────
  "fish":       ["salmon", "tuna", "cod", "tilapia", "catfish", "bass", "halibut", "trout", "sardine", "anchovy", "mahi", "snapper", "flounder", "pollock", "herring", "mackerel", "swordfish", "carp", "pike", "perch"],
  // Dairy / Milk ─────────────────────────────────────────────────────────────
  "dairy":      ["milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "whey", "casein", "lactose", "ghee", "kefir", "quark", "sour cream", "ricotta", "mozzarella", "parmesan", "cheddar", "brie", "feta", "mascarpone", "custard"],
  "milk":       ["milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "whey", "casein", "lactose", "ghee", "kefir", "sour cream", "ricotta", "mozzarella", "parmesan", "cheddar"],
  "lactose":    ["milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "whey", "casein", "lactose", "ghee"],
  // Eggs ─────────────────────────────────────────────────────────────────────
  "egg":        ["egg", "eggs", "mayonnaise", "mayo", "meringue", "albumin", "ovomucin", "lysozyme", "ovalbumin"],
  "eggs":       ["egg", "eggs", "mayonnaise", "mayo", "meringue", "albumin", "ovomucin", "lysozyme", "ovalbumin"],
  // Wheat / Gluten ───────────────────────────────────────────────────────────
  "wheat":      ["wheat", "flour", "bread", "pasta", "gluten", "barley", "rye", "spelt", "semolina", "durum", "farro", "kamut", "seitan"],
  "gluten":     ["wheat", "flour", "bread", "pasta", "gluten", "barley", "rye", "spelt", "semolina", "seitan"],
  "grain":      ["wheat", "barley", "rye", "oat", "spelt", "millet"],
  // Soy ──────────────────────────────────────────────────────────────────────
  "soy":        ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "natto", "tamari", "soy sauce"],
  "soya":       ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "natto", "tamari"],
  "soybean":    ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "natto"],
  "soybeans":   ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "natto"],
  // Sesame ───────────────────────────────────────────────────────────────────
  "sesame":     ["sesame", "tahini", "sesame oil", "sesame seed"],
  // Sulfites / Sulphites ─────────────────────────────────────────────────────
  "sulfite":    ["sulfite", "sulphite", "metabisulfite"],
  "sulfites":   ["sulfite", "sulphite", "metabisulfite"],
  "sulphite":   ["sulfite", "sulphite", "metabisulfite"],
  "sulphites":  ["sulfite", "sulphite", "metabisulfite"],
  // Legumes ──────────────────────────────────────────────────────────────────
  "legume":     ["peanut", "soy", "lentil", "chickpea", "pea", "lupine", "lupin"],
  "legumes":    ["peanut", "soy", "lentil", "chickpea", "pea", "lupine", "lupin"],
};
/**
 * Extracts a flat list of ingredient name strings from any meal JSON.
 * Handles the known builder schemas:
 *   - ingredients: Array<{ name }> (most builders)
 *   - shoppingList: Array<{ item }> (Grocery Coach)
 *   - ownedIngredients: Array<{ item }> (Grocery Coach)
 *   - components: Array<{ ingredients: Array<{ name }> }> (meal plan)
 */
export function extractIngredientNames(meal: Record<string, unknown>): string[] {
  const names: string[] = [];

  if (Array.isArray(meal.ingredients)) {
    for (const ing of meal.ingredients) {
      if (ing && typeof ing === "object") {
        const n = (ing as Record<string, unknown>).name;
        if (typeof n === "string" && n.trim()) names.push(n.trim());
      } else if (typeof ing === "string" && ing.trim()) {
        names.push(ing.trim());
      }
    }
  }

  for (const field of ["shoppingList", "ownedIngredients"] as const) {
    if (Array.isArray(meal[field])) {
      for (const entry of (meal as any)[field]) {
        if (entry && typeof entry === "object") {
          const item = entry.item;
          if (typeof item === "string" && item.trim()) names.push(item.trim());
        }
      }
    }
  }

  if (Array.isArray(meal.components)) {
    for (const comp of meal.components) {
      if (comp && typeof comp === "object") {
        const compObj = comp as Record<string, unknown>;
        if (Array.isArray(compObj.ingredients)) {
          for (const ing of compObj.ingredients) {
            if (ing && typeof ing === "object") {
              const n = (ing as Record<string, unknown>).name;
              if (typeof n === "string" && n.trim()) names.push(n.trim());
            }
          }
        }
      }
    }
  }

  return Array.from(new Set(names));
}

// ── MealRefinementEngine class (Phase 1: replace_ingredient) ──────────────────

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
      case "adjust_macros":
        return this._adjustMacros(request);
      case "change_cooking_method":
        return this._changeCookingMethod(request);
      default: {
        throw new Error(`Unsupported refinement changeType: ${(request as any).changeType}`);
      }
    }
  }

  // ── replace_ingredient ────────────────────────────────────────────────────

  private async _replaceIngredient(req: ReplaceIngredientRequest): Promise<SwapRefinementResult> {
    const { userId, ingredientToReplace, mealName, mealDescription, remainingIngredients, userRequest } = req;

    const { envelope, protocolContext, glp1Block, glp1Targets, savedBlock } =
      await loadProtocolContext(userId);

    // ── Build system prompt ────────────────────────────────────────────────────
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
  "coachSuggestion": { "item": "string", "reason": "string — 1-2 sentences", "quantity": "string", "unit": "string", "fat_grams": number | null },
  "savedOption": { "item": "string", "reason": "string — mention it's from their saved products" } | null,
  "alternatives": [{ "item": "string", "reason": "string" }],
  "protocolNote": "string | null"
}`;

    // ── LLM call ───────────────────────────────────────────────────────────
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

    // ── GLP-1 fat ceiling validation ──────────────────────────────────────
    // fat_grams is only considered verified when it is a finite non-negative number.
    // Absent, null, non-finite, or negative values are all treated as UNVERIFIED.
    const extractFatGrams = (suggestion: any): number | null => {
      const v = suggestion?.fat_grams;
      return typeof v === "number" && isFinite(v) && v >= 0 ? v : null;
    };

    const fatCeiling =
      glp1Targets !== null
        ? (glp1Targets.maximumToleratedFatGrams ?? null)
        : null;

    if (fatCeiling !== null) {
      const initialFat = extractFatGrams(swapData.coachSuggestion);
      const initialExceeds = initialFat !== null && initialFat > fatCeiling;
      const initialUnverified = initialFat === null;

      if (initialExceeds || initialUnverified) {
        const correctionNote = initialExceeds
          ? `CRITICAL CORRECTION: Your previous suggestion contained ${initialFat}g fat, exceeding the GLP-1 ceiling of ${fatCeiling}g. You MUST suggest a replacement with fat_grams ≤${fatCeiling}g.`
          : `CRITICAL REQUIREMENT: GLP-1 is active with a fat ceiling of ${fatCeiling}g per meal. You MUST include a numeric fat_grams estimate in coachSuggestion — do not omit or null it.`;

        const retryPrompt = `${systemPrompt}

${correctionNote} Set fat_grams to a realistic finite number in the JSON response. This is a clinical safety requirement — do not ignore it.`;

        let retrySwapData: any = null;
        try {
          const retryCompletion = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: retryPrompt },
              {
                role: "user",
                content: userRequest
                  ? `Replace ${ingredientToReplace} with ${userRequest}`
                  : `Find the best replacement for ${ingredientToReplace}`,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.5,
            max_tokens: 600,
          });
          const retryRaw = retryCompletion.choices[0]?.message?.content ?? "{}";
          try { retrySwapData = JSON.parse(retryRaw); } catch { retrySwapData = null; }
        } catch {
          // Retry call failed — fall through to warning on original swapData.
        }

        const retryFat = extractFatGrams(retrySwapData?.coachSuggestion);
        const retryCompliant =
          retrySwapData?.coachSuggestion?.item &&
          retryFat !== null &&
          retryFat <= fatCeiling;

        if (retryCompliant) {
          swapData = retrySwapData;
        } else {
          if (retrySwapData?.coachSuggestion?.item) swapData = retrySwapData;
          const existing = swapData.protocolNote ? `${swapData.protocolNote} ` : "";
          const finalFat = extractFatGrams(swapData.coachSuggestion);
          swapData.protocolNote = finalFat === null
            ? `${existing}⚠ GLP-1 fat ceiling: unable to verify the fat content of this swap against your ${fatCeiling}g limit. Confirm with your care team before adding it.`
            : `${existing}⚠ GLP-1 fat ceiling: this swap may exceed your ${fatCeiling}g fat limit per meal. Choose a lower-fat option or check with your care team before adding it.`;
        }
      }
    }

    // ── Protocol scan on the suggestion ───────────────────────────────────
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

  // ── adjust_macros ─────────────────────────────────────────────────────────

  private async _adjustMacros(req: AdjustMacrosRequest): Promise<MacroAdjustmentResult> {
    const {
      userId,
      macroGoal,
      mealName,
      mealDescription,
      currentIngredients,
      currentMacros,
    } = req;

    // Strict: throws if protocol envelope or GLP-1 resolver is unavailable.
    const { envelope, protocolContext, glp1Block, glp1Targets, savedBlock } =
      await loadProtocolContextStrict(userId);

    // ── Pre-generation baseline allergen check ────────────────────────────────
    // Reject immediately if the client-supplied ingredient list contains a
    // confirmed allergen. The model is instructed to preserve those ingredients,
    // so silently forwarding them would bypass the post-gen allergen guard.
    if (Array.isArray(currentIngredients) && currentIngredients.length > 0) {
      const baselineAllergen = findAllergenInText(
        currentIngredients.join(" "),
        envelope.allergies ?? [],
      );
      if (baselineAllergen) {
        throw new Error(
          `Your ingredient list contains "${baselineAllergen}", which is a confirmed allergen. ` +
          `Please update the meal before requesting a macro adjustment.`,
        );
      }
    }

    const ingredientList =
      Array.isArray(currentIngredients) && currentIngredients.length > 0
        ? currentIngredients.join(", ")
        : "not specified";

    const macroSnapshot =
      currentMacros
        ? Object.entries(currentMacros)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}: ${v}${k === "calories" ? " kcal" : "g"}`)
            .join(", ")
        : null;

    const buildSystemPrompt = (extraInstruction = "") =>
      `You are a Macro Adjustment Coach. The user wants to adjust the macronutrient profile of an existing meal without completely rebuilding it.

USER HEALTH PROFILE:
${protocolContext || "No dietary restrictions on file — apply general healthy eating principles."}
${glp1Block ? `\n${glp1Block}` : ""}
${savedBlock ? `\n\n${savedBlock}` : ""}

MEAL CONTEXT:
Meal: ${mealName || "current meal"}${mealDescription ? `\nDescription: ${mealDescription}` : ""}
Current ingredients: ${ingredientList}
${macroSnapshot ? `Current estimated macros: ${macroSnapshot}` : ""}

MACRO GOAL: "${macroGoal}"
${extraInstruction}
Rules:
- Make the MINIMUM ingredient changes needed to achieve the macro goal — preserve the dish identity
- Every change must be clinically safe for this user (respect allergies, conditions, GLP-1 limits)
- NEVER introduce any ingredient the user is allergic to or that violates their active dietary protocol
- adjustedIngredients: list only the ingredients that actually change (add, remove, swap, or resize); unchanged ingredients are omitted
- macroImpact: estimate the new macro values and provide a short human-readable summary of the delta
- coachNote: a warm 1-2 sentence coach-voice explanation of what changed and why
- protocolNote: short clinical note only when genuinely relevant to this user's conditions, otherwise null

Respond ONLY with valid JSON:
{
  "adjustedIngredients": [
    { "item": "string", "change": "string — what changed, e.g. 'swapped to Greek yogurt'", "reason": "string" }
  ],
  "macroImpact": {
    "calories": number | null,
    "protein": number | null,
    "carbs": number | null,
    "fat": number | null,
    "summary": "string — e.g. '+18g protein, -5g fat'"
  },
  "coachNote": "string",
  "protocolNote": "string | null"
}`;

    const runLLM = async (systemPrompt: string) => {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: macroGoal },
        ],
        response_format: { type: "json_object" },
        temperature: 0.65,
        max_tokens: 700,
      });
      return completion.choices[0]?.message?.content ?? "{}";
    };

    const parseAndValidate = (raw: string) => {
      let data: any;
      try { data = JSON.parse(raw); } catch {
        throw new Error("Could not parse macro adjustment response from LLM.");
      }
      if (!Array.isArray(data.adjustedIngredients)) {
        throw new Error("Macro adjustment response missing adjustedIngredients.");
      }
      if (!data.macroImpact?.summary) {
        throw new Error("Macro adjustment response missing macroImpact.");
      }
      return data;
    };

    /**
     * Build the full scan payload for a macro-adjustment response.
     * • description = extractAllStrings(data) covers every text field.
     * • instructions = coachNote so that scanGeneratedOutput evaluates it
     *   against envelope.procedural.forbiddenInstructions (e.g. cross-
     *   contamination rules, halal/kosher prep rules).
     * • ingredients includes BOTH the baseline currentIngredients (preserved
     *   by the model) AND the adjusted ingredients.
     */
    const buildScanPayload = (data: any) => ({
      name: `Macro adjustment: ${mealName || "meal"}`,
      description: extractAllStrings(data),
      ingredients: [
        ...(Array.isArray(currentIngredients)
          ? currentIngredients.map(i => ({ name: String(i) }))
          : []),
        ...(data.adjustedIngredients as any[]).map((ai: any) => ({
          name: typeof ai.item === "string" ? ai.item : "",
        })),
      ],
      // coachNote contains actionable prep guidance — enforce procedural rules on it
      instructions: typeof data.coachNote === "string" ? data.coachNote : undefined,
    });

    /** Returns a violation message string, or null if safe. */
    const checkViolations = (data: any): string | null => {
      const payload = buildScanPayload(data);
      // 1. avoidances + dietary identity + procedural (instructions) via scanGeneratedOutput
      const scan = scanGeneratedOutput(payload, envelope, {
        generatorName: "macro_adjustment",
        skipAdaptableConflicts: true,
      });
      if (!scan.passed) return scan.message;
      // 2. explicit allergen guard on the FULL response text
      const allergenHit = findAllergenInText(extractAllStrings(data), envelope.allergies ?? []);
      if (allergenHit) {
        return `This suggestion contains "${allergenHit}", which is listed as a confirmed allergen for this user.`;
      }
      // 3. GLP-1 numeric enforcement — null/missing/non-numeric estimates are
      //    violations when clinical targets are active. We require typeof === "number"
      //    to reject "", false, true, "25", whitespace, and any other non-numeric
      //    JSON value that Number() would coerce to a finite number.
      if (glp1Targets) {
        const rawFat = data.macroImpact?.fat;
        const rawCal = data.macroImpact?.calories;
        if (typeof rawFat !== "number" || !Number.isFinite(rawFat) || rawFat < 0) {
          return "GLP-1 protocol requires a numeric fat estimate — the response did not provide one.";
        }
        if (rawFat > glp1Targets.maximumToleratedFatGrams) {
          return (
            `GLP-1 fat ceiling exceeded: ${rawFat}g fat (limit ${glp1Targets.maximumToleratedFatGrams}g). ` +
            `Please request a lower-fat adjustment.`
          );
        }
        if (typeof rawCal !== "number" || !Number.isFinite(rawCal) || rawCal < 0) {
          return "GLP-1 protocol requires a numeric calorie estimate — the response did not provide one.";
        }
        if (rawCal > glp1Targets.resolvedMealCalories * 1.25) {
          return (
            `GLP-1 calorie ceiling exceeded: ${Math.round(rawCal)} kcal ` +
            `(limit ~${glp1Targets.resolvedMealCalories} kcal). Please request a lighter adjustment.`
          );
        }
      }
      return null;
    };

    // ── First attempt ─────────────────────────────────────────────────────────
    let data = parseAndValidate(await runLLM(buildSystemPrompt()));
    let violation = checkViolations(data);

    // ── Retry if violation detected ───────────────────────────────────────────
    if (violation) {
      console.warn(`[MealRefinement/AdjustMacros] Protocol violation on first pass — retrying. ${violation}`);
      const retryInstruction =
        `\n\nCRITICAL CORRECTION — RETRY REQUIRED: Your previous suggestion violated the user's dietary protocol: ${violation}. ` +
        `You MUST NOT include any allergen or protocol-forbidden ingredient — not as a swap target, ` +
        `side ingredient, or preparation component. Recommend a fully compliant alternative.\n`;
      try {
        data = parseAndValidate(await runLLM(buildSystemPrompt(retryInstruction)));
        violation = checkViolations(data);
      } catch (retryErr: any) {
        throw new Error(`Macro adjustment unavailable — could not produce a safe recommendation. ${retryErr?.message}`);
      }
    }

    // ── Block if retry also violates ──────────────────────────────────────────
    if (violation) {
      console.error(`[MealRefinement/AdjustMacros] Both attempts violated protocol — blocking. ${violation}`);
      throw new Error(
        `This macro adjustment conflicts with your active health protocol and cannot be shown safely. ` +
        `Please try a different goal or ask your coach for guidance.`,
      );
    }

    return {
      adjustedIngredients: data.adjustedIngredients,
      macroImpact: data.macroImpact,
      coachNote: typeof data.coachNote === "string" ? data.coachNote : "",
      protocolNote: data.protocolNote ?? null,
    };
  }

  // ── change_cooking_method ─────────────────────────────────────────────────

  private async _changeCookingMethod(req: ChangeCookingMethodRequest): Promise<CookingMethodResult> {
    const {
      userId,
      targetMethod,
      mealName,
      mealDescription,
      currentIngredients,
      currentMethod,
    } = req;

    // Strict: throws if protocol envelope or GLP-1 resolver is unavailable.
    const { envelope, protocolContext, glp1Block, glp1Targets } =
      await loadProtocolContextStrict(userId);

    // ── Pre-generation baseline allergen check ────────────────────────────────
    if (Array.isArray(currentIngredients) && currentIngredients.length > 0) {
      const baselineAllergen = findAllergenInText(
        currentIngredients.join(" "),
        envelope.allergies ?? [],
      );
      if (baselineAllergen) {
        throw new Error(
          `Your ingredient list contains "${baselineAllergen}", which is a confirmed allergen. ` +
          `Please update the meal before requesting a cooking method change.`,
        );
      }
    }

    const ingredientList =
      Array.isArray(currentIngredients) && currentIngredients.length > 0
        ? currentIngredients.join(", ")
        : "not specified";

    const buildSystemPrompt = (extraInstruction = "") =>
      `You are a Culinary Technique Coach. The user wants to convert an existing meal to a different cooking method without changing its overall concept.

USER HEALTH PROFILE:
${protocolContext || "No dietary restrictions on file — apply general healthy eating principles."}
${glp1Block ? `\n${glp1Block}` : ""}

MEAL CONTEXT:
Meal: ${mealName || "current meal"}${mealDescription ? `\nDescription: ${mealDescription}` : ""}
Current method: ${currentMethod || "not specified"}
Current ingredients: ${ingredientList}

TARGET METHOD: "${targetMethod}"
${extraInstruction}
Rules:
- Rewrite ONLY what needs to change for the new cooking method — keep the dish recognisable
- Every change must be clinically safe for this user (no added allergens, no protocol violations)
- NEVER introduce any ingredient the user is allergic to or that violates their active dietary protocol
- newMethod: canonical name for the cooking method (e.g. "Air Fryer", "Slow Cooker")
- cookingNotes: clear step-by-step or key technique instructions for the new method (2-4 sentences)
- cookingTips: 1-3 practical tips specific to this method/dish combination
- ingredientChanges: list only ingredients that need adjustment for the method (quantity, prep, or swap); omit unchanged ones
- estimatedMealFatGrams: your best estimate of the total fat (g) in the complete meal after this method change; include any oils, coatings, or fat added by the technique; use null if you cannot estimate
- protocolNote: short clinical note only if the method change affects clinical compliance (e.g. added oil for air fryer exceeds GLP-1 fat limit), otherwise null

Respond ONLY with valid JSON:
{
  "newMethod": "string",
  "cookingNotes": "string",
  "cookingTips": [
    { "tip": "string", "reason": "string — optional, why this tip matters" }
  ],
  "ingredientChanges": [
    { "item": "string", "change": "string — what changes and why" }
  ],
  "estimatedMealFatGrams": number | null,
  "protocolNote": "string | null"
}`;

    const runLLM = async (systemPrompt: string) => {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Convert this meal to ${targetMethod}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.65,
        max_tokens: 700,
      });
      return completion.choices[0]?.message?.content ?? "{}";
    };

    const parseAndValidate = (raw: string) => {
      let data: any;
      try { data = JSON.parse(raw); } catch {
        throw new Error("Could not parse cooking method response from LLM.");
      }
      if (!data.newMethod || !data.cookingNotes) {
        throw new Error("Cooking method response missing required fields.");
      }
      return data;
    };

    /**
     * Build the full scan payload for a cooking-method response.
     * • description = extractAllStrings(data) covers every text field.
     * • instructions = cookingNotes + tip text so that scanGeneratedOutput
     *   evaluates them against envelope.procedural.forbiddenInstructions
     *   (e.g. cross-contamination rules, halal/kosher prep requirements).
     * • ingredients includes BOTH the baseline currentIngredients (preserved
     *   by the model) AND the ingredientChanges.
     */
    const buildScanPayload = (data: any) => {
      const tipTexts = (Array.isArray(data.cookingTips) ? data.cookingTips : [])
        .flatMap((t: any) => [t.tip, t.reason].filter(Boolean))
        .join(" ");
      return {
        name: `Cooking method change: ${mealName || "meal"}`,
        description: extractAllStrings(data),
        ingredients: [
          ...(Array.isArray(currentIngredients)
            ? currentIngredients.map(i => ({ name: String(i) }))
            : []),
          ...(Array.isArray(data.ingredientChanges) ? data.ingredientChanges : [])
            .map((ic: any) => ({ name: typeof ic.item === "string" ? ic.item : "" }))
            .filter((x: any) => x.name),
        ],
        // cookingNotes + tip text carry procedural instructions — enforce forbidden-instruction rules
        instructions: [
          typeof data.cookingNotes === "string" ? data.cookingNotes : "",
          tipTexts,
        ].filter(Boolean).join(" ") || undefined,
      };
    };

    /** Returns a violation message string, or null if safe. */
    const checkViolations = (data: any): string | null => {
      const payload = buildScanPayload(data);
      // 1. avoidances + dietary identity + procedural (covers baseline + changed)
      const scan = scanGeneratedOutput(payload, envelope, {
        generatorName: "cooking_method_change",
        skipAdaptableConflicts: true,
      });
      if (!scan.passed) return scan.message;
      // 2. explicit allergen guard on the FULL response text
      const allergenHit = findAllergenInText(extractAllStrings(data), envelope.allergies ?? []);
      if (allergenHit) {
        return `This suggestion contains "${allergenHit}", which is listed as a confirmed allergen for this user.`;
      }
      // 3. GLP-1 numeric enforcement — null/missing/non-numeric estimates are
      //    violations when clinical targets are active. typeof === "number" rejects
      //    "", false, "25", whitespace, and other JSON values Number() would accept.
      if (glp1Targets) {
        const rawFat = data.estimatedMealFatGrams;
        if (typeof rawFat !== "number" || !Number.isFinite(rawFat) || rawFat < 0) {
          return "GLP-1 protocol requires a numeric fat estimate — the response did not provide one.";
        }
        if (rawFat > glp1Targets.maximumToleratedFatGrams) {
          return (
            `GLP-1 fat ceiling exceeded: estimated ${rawFat}g fat for this method ` +
            `(limit ${glp1Targets.maximumToleratedFatGrams}g). Please choose a lower-fat cooking method.`
          );
        }
      }
      return null;
    };

    // ── First attempt ─────────────────────────────────────────────────────────
    let data = parseAndValidate(await runLLM(buildSystemPrompt()));
    let violation = checkViolations(data);

    // ── Retry if violation detected ───────────────────────────────────────────
    if (violation) {
      console.warn(`[MealRefinement/CookingMethod] Protocol violation on first pass — retrying. ${violation}`);
      const retryInstruction =
        `\n\nCRITICAL CORRECTION — RETRY REQUIRED: Your previous suggestion violated the user's dietary protocol: ${violation}. ` +
        `You MUST NOT include any allergen or protocol-forbidden ingredient anywhere in the cooking method, ` +
        `instructions, tips, or ingredient changes. Recommend a fully compliant alternative.\n`;
      try {
        data = parseAndValidate(await runLLM(buildSystemPrompt(retryInstruction)));
        violation = checkViolations(data);
      } catch (retryErr: any) {
        throw new Error(`Cooking method change unavailable — could not produce a safe recommendation. ${retryErr?.message}`);
      }
    }

    // ── Block if retry also violates ──────────────────────────────────────────
    if (violation) {
      console.error(`[MealRefinement/CookingMethod] Both attempts violated protocol — blocking. ${violation}`);
      throw new Error(
        `This cooking method change conflicts with your active health protocol and cannot be shown safely. ` +
        `Please try a different cooking method or ask your coach for guidance.`,
      );
    }

    return {
      newMethod: data.newMethod,
      cookingNotes: data.cookingNotes,
      cookingTips: Array.isArray(data.cookingTips) ? data.cookingTips : [],
      ingredientChanges: Array.isArray(data.ingredientChanges) ? data.ingredientChanges : [],
      protocolNote: data.protocolNote ?? null,
      estimatedMealFatGrams:
        data.estimatedMealFatGrams != null && Number.isFinite(Number(data.estimatedMealFatGrams))
          ? Number(data.estimatedMealFatGrams)
          : null,
    };
  }
}

/** Singleton — re-use across requests to avoid re-initialising the OpenAI client. */
let _engine: MealRefinementEngine | null = null;
export function getMealRefinementEngine(): MealRefinementEngine {
  if (!_engine) _engine = new MealRefinementEngine();
  return _engine;
}

// ── Universal function API ────────────────────────────────────────────────────
// refineMeal() is the universal entry point for any builder to modify an existing
// meal. It has full clinical enforcement: GLP-1 fail-closed, combined NDE +
// starch-gate + GLP-1 validation, retry, and final re-validation.

export interface MealRefinementRequest {
  /** Authenticated user ID. */
  userId: string;
  /**
   * The full existing meal JSON — whatever schema the originating builder returned.
   * Grocery Coach: { meal, shoppingList, ownedIngredients, macros, reasoning, ... }
   * Regular builders: { name, description, ingredients, instructions, macros, ... }
   * The engine returns an updated object in the SAME schema.
   */
  existingMeal: Record<string, unknown>;
  /**
   * Natural-language change instruction.
   * Examples: "Replace chicken with tofu", "Make it dairy-free", "Add more protein",
   *   "Make the texture softer", "Reduce the starch", "Make it kid-friendly"
   */
  changeInstruction: string;
  /** Meal slot — used by the GLP-1 resolver for per-meal targets. Default: "lunch". */
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  /**
   * Generator name for NDE scan and audit logging.
   * Use the originating builder's name. Default: "meal_refinement"
   */
  generatorName?: string;
}

export interface RefinedMeal {
  /** The updated meal — same JSON schema as the input existingMeal. */
  updatedMeal: Record<string, unknown>;
  /** Human-readable summary of what changed and why. */
  changesSummary: string;
  /**
   * Protocol note if there was a soft conflict or GLP-1 protein-floor note appended.
   * Null when the refinement was fully compliant.
   */
  protocolNote: string | null;
}

// ── Combined validation result ─────────────────────────────────────────────────

interface ValidationResult {
  /** True when the meal passes all active gates. */
  passed: boolean;
  /** NDE scan result. */
  ndeScan: ProtocolScanResult;
  /** GLP-1 fat/calorie/protein issues, if any. */
  glp1Issues: {
    fatViolation: boolean;
    calViolation: boolean;
    protFloor: boolean;
    absentMacros: boolean; // macros missing/non-finite on a GLP-1 meal
  } | null;
  /** Starch budget triggered for a diabetic user. */
  starchGateTriggered: boolean;
  /** Composite correction instruction to append on retry. */
  correctionInstruction: string;
}

function extractMacros(meal: Record<string, unknown>): {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
} {
  const macros = meal.macros as Record<string, unknown> | null | undefined;
  if (!macros || typeof macros !== "object") {
    return { calories: null, protein: null, fat: null, carbs: null };
  }
  const toNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    calories: toNum(macros.calories),
    protein:  toNum(macros.protein),
    fat:      toNum(macros.fat),
    carbs:    toNum(macros.carbs),
  };
}

/**
 * Extracts cooking instruction text from any meal JSON.
 * Handles: instructions (string | string[]), steps (string[]),
 * cookingSteps (string[]), cookingInstructions (string[]).
 * Returns a single joined string, or undefined when none found.
 */
function extractInstructionsText(meal: Record<string, unknown>): string | undefined {
  for (const field of ["instructions", "steps", "cookingSteps", "cookingInstructions"] as const) {
    const val = (meal as any)[field];
    if (typeof val === "string" && val.trim()) return val.trim();
    if (Array.isArray(val) && val.length > 0) {
      const joined = val
        .filter((s) => typeof s === "string" || (s && typeof s === "object" && typeof (s as any).text === "string"))
        .map((s) => (typeof s === "string" ? s : (s as any).text ?? ""))
        .join(" ");
      if (joined.trim()) return joined.trim();
    }
  }
  return undefined;
}

function validateMeal(
  meal: Record<string, unknown>,
  mealName: string,
  envelope: UserProtocolEnvelope,
  glp1Targets: ResolvedGLP1Targets | null,
  generatorName: string,
): ValidationResult {
  const ingredientNames = extractIngredientNames(meal);
  const instructionsText = extractInstructionsText(meal);
  const mealForScan = {
    name: mealName,
    description: (meal.description as string | undefined) ?? "",
    ingredients: ingredientNames.map((n) => ({ name: n })),
    // Pass instruction text so scanGeneratedOutput can check forbidden
    // preparation phrases (e.g. "fry in lard", "add pork broth") defined in
    // the procedural layer — an ingredient-clean meal can still be protocol-
    // wrong if cooking instructions violate a dietary rule.
    ...(instructionsText ? { instructions: instructionsText } : {}),
  };

  const ndeScan = scanGeneratedOutput(mealForScan, envelope, {
    generatorName,
    skipAdaptableConflicts: true,
  });

  const corrections: string[] = [];

  // ── NDE violations ────────────────────────────────────────────────────────
  if (!ndeScan.passed) {
    const violatingTerms = ndeScan.violations.map((v: any) => v.term).filter(Boolean);
    const exclusionClause =
      violatingTerms.length > 0
        ? `"${violatingTerms.join('", "')}" (${ndeScan.primaryViolation?.reason ?? "conflicts with active dietary protocol"})`
        : "certain ingredients that conflict with the active dietary protocol";
    corrections.push(
      `PROTOCOL EXCLUSION: The meal included ${exclusionClause}. ` +
      `Do NOT include ${violatingTerms.length > 0 ? violatingTerms.join(", ") + " or any derivative" : "those ingredients"} ` +
      `anywhere in the meal.`,
    );
  }

  // ── Diabetic starch gate ──────────────────────────────────────────────────
  const starchGateTriggered = Boolean(
    envelope.hasDiabetes && ndeScan.starchBudgetViolation?.detected,
  );
  if (starchGateTriggered) {
    const starchTerms = ndeScan.starchBudgetViolation?.terms ?? [];
    corrections.push(
      `DIABETIC STARCH GATE: The meal contains starchy ingredients (${starchTerms.join(", ") || "see above"}) ` +
      `that exceed the diabetic starch budget. Replace starchy components with non-starchy vegetables, ` +
      `lean proteins, or legumes. Keep total carbs well within the diabetic meal limit.`,
    );
  }

  // ── GLP-1 macro gate ─────────────────────────────────────────────────────
  let glp1Issues: ValidationResult["glp1Issues"] = null;
  if (glp1Targets) {
    const macros = extractMacros(meal);

    // Absent/non-finite macros = cannot verify GLP-1 compliance = treat as violation.
    const absentMacros = macros.fat === null || macros.calories === null;
    const fatViolation = !absentMacros && macros.fat! > glp1Targets.maximumToleratedFatGrams;
    const calViolation = !absentMacros && macros.calories! > glp1Targets.resolvedMealCalories * 1.25;
    const protFloor =
      macros.protein !== null && macros.protein < glp1Targets.minimumProteinFloor * 0.75;

    glp1Issues = { fatViolation, calViolation, protFloor, absentMacros };

    if (absentMacros) {
      corrections.push(
        `GLP-1 MACRO REQUIRED: You must include a "macros" object with numeric calories, protein, fat, and carbs. ` +
        `GLP-1 compliance cannot be verified without it. ` +
        `Targets: ≤${glp1Targets.maximumToleratedFatGrams}g fat, ≤${glp1Targets.resolvedMealCalories} kcal.`,
      );
    } else if (fatViolation || calViolation) {
      corrections.push(
        `GLP-1 MACRO CORRECTION: ` +
        `${fatViolation ? `Fat ${macros.fat}g exceeds limit ${glp1Targets.maximumToleratedFatGrams}g. ` : ""}` +
        `${calViolation ? `Calories ${Math.round(macros.calories!)} exceeds limit ${glp1Targets.resolvedMealCalories} kcal. ` : ""}` +
        `Use lean proteins and non-oily methods. ` +
        `Fat MUST be ≤${glp1Targets.maximumToleratedFatGrams}g and calories ≤${glp1Targets.resolvedMealCalories} kcal.`,
      );
    }
  }

  const ndeOrStarchFailed = !ndeScan.passed || starchGateTriggered;
  const glp1Failed = glp1Issues !== null &&
    (glp1Issues.fatViolation || glp1Issues.calViolation || glp1Issues.absentMacros);
  const passed = !ndeOrStarchFailed && !glp1Failed;

  return {
    passed,
    ndeScan,
    glp1Issues,
    starchGateTriggered,
    correctionInstruction:
      corrections.length > 0
        ? `\n\nCRITICAL CORRECTION — RETRY REQUIRED:\n${corrections.join("\n\n")}`
        : "",
  };
}

// ── Schema preservation helper ────────────────────────────────────────────────

/**
 * Critical keys are those the LLM MUST supply; non-critical keys are restored
 * verbatim from the existing meal when the LLM omits them. If the LLM drops a
 * critical key the caller MUST retry — the output is structurally incomplete.
 */
const SCHEMA_CRITICAL_KEYS = ["ingredients", "shoppingList", "macros", "meal"] as const;

/**
 * Applies schema preservation to a raw LLM-parsed meal object:
 *  - Non-critical keys absent from `llmMeal` are filled from `existingMeal`.
 *  - Returns the patched meal and a list of any critical keys that are STILL
 *    absent (callers must treat these as validation failures and retry).
 */
function applySchemaPreservation(
  llmMeal: Record<string, unknown>,
  existingMeal: Record<string, unknown>,
): { meal: Record<string, unknown>; missingCritical: string[] } {
  const inputKeys = Object.keys(existingMeal);
  const criticalSet = new Set<string>(SCHEMA_CRITICAL_KEYS);

  // Restore non-critical keys the LLM dropped.
  for (const k of inputKeys) {
    if (!criticalSet.has(k) && !(k in llmMeal)) {
      llmMeal[k] = existingMeal[k];
    }
  }

  // Identify critical keys that are still missing.
  const missingCritical = SCHEMA_CRITICAL_KEYS.filter(
    (k) => inputKeys.includes(k) && !(k in llmMeal),
  );

  return { meal: llmMeal, missingCritical };
}

// ─── Core engine ─────────────────────────────────────────────────────────────

/**
 * Refine an existing meal according to a natural-language change instruction.
 *
 * The engine:
 *   1. Loads the user's full protocol context (envelope, GLP-1, saved groceries)
 *   2. Calls the LLM with full existing meal JSON + change instruction + constraints
 *   3. Runs a combined validation pass: NDE scan + GLP-1 macro gate + diabetic starch gate
 *   4. On any failure: single retry with a combined correction instruction
 *   5. Re-validates the retry result through the same combined pass
 *   6. Throws on any post-retry failure — no output escapes validation
 *
 * Throws MealRefinementRetryableError when the service is temporarily unavailable
 * (GLP-1 resolver down, DB failure). Callers should surface this as 503.
 *
 * Throws Error with PROTOCOL_VIOLATION prefix on hard clinical violations.
 * Throws Error on permanent post-retry failures (surfaces as 422).
 */
export async function refineMeal(request: MealRefinementRequest): Promise<RefinedMeal> {
  const {
    userId,
    existingMeal,
    changeInstruction,
    mealType = "lunch",
    generatorName = "meal_refinement",
  } = request;

  // ── 1. Load protocol envelope ─────────────────────────────────────────────
  let envelope: UserProtocolEnvelope = buildGuestEnvelope();
  let protocolContext = "";

  try {
    envelope = (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope();
    protocolContext = enforceBeforeGenerate(envelope, { generatorName }).combined;
  } catch {
    /* proceed with guest envelope — non-fatal */
  }

  // ── 2. Load GLP-1 context — FAIL CLOSED ──────────────────────────────────
  // Mirrors the canonical pattern from groceryCoach.ts /recommend:
  //   • resolver throws → 503 (we can't determine GLP-1 status)
  //   • isActive with no resolvedTargets → 503 (targets required for enforcement)
  let glp1Targets: ResolvedGLP1Targets | null = null;
  let glp1Block = "";

  const todayISO = new Date().toISOString().slice(0, 10);
  let glp1Ctx: Awaited<ReturnType<typeof resolveGLP1GlobalContext>> | null;

  try {
    glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO, mealType).catch(() => null);
  } catch {
    glp1Ctx = null;
  }

  if (glp1Ctx === null) {
    throw new MealRefinementRetryableError(
      "Clinical guidance temporarily unavailable. Please try again.",
    );
  }

  if (glp1Ctx.isActive && !glp1Ctx.resolvedTargets) {
    throw new MealRefinementRetryableError(
      "GLP-1 clinical targets temporarily unavailable. Please try again.",
    );
  }

  if (glp1Ctx.isActive) {
    glp1Block = buildGLP1RecommendationBlock(glp1Ctx);
    glp1Targets = glp1Ctx.resolvedTargets;
  }

  // ── 3. Load saved groceries (non-fatal) ──────────────────────────────────
  let savedGroceriesBlock = "";

  try {
    const sgRows = await db
      .select({
        id: userSavedGroceryItems.id,
        productName: userSavedGroceryItems.productName,
        brand: userSavedGroceryItems.brand,
        category: userSavedGroceryItems.category,
        productKey: userSavedGroceryItems.productKey,
        nutritionJson: userSavedGroceryItems.nutritionJson,
        productMeta: userSavedGroceryItems.productMeta,
        savedAt: userSavedGroceryItems.savedAt,
      })
      .from(userSavedGroceryItems)
      .where(eq(userSavedGroceryItems.userId, userId));

    if (sgRows.length > 0) {
      const itemsWithIngredients = sgRows.map((row) => {
        const meta = row.productMeta as Record<string, unknown> | null;
        const ingredients = Array.isArray(meta?.ingredients)
          ? (meta!.ingredients as string[]).filter((i) => typeof i === "string")
          : null;
        return { ...row, ingredients };
      });

      const diabeticCarbCeiling: number | null = envelope.hasDiabetes ? 45 : null;

      const { compliant } = filterSavedGroceriesForCompliance(
        itemsWithIngredients as any,
        envelope,
        { glp1Targets, isDiabetic: envelope.hasDiabetes, diabeticCarbCeiling },
      );
      savedGroceriesBlock = buildSavedGroceriesPromptBlock(compliant);
    }
  } catch (sgErr: any) {
    console.warn("[MealRefinementEngine] Could not load saved groceries:", sgErr?.message);
  }

  // ── 4. Build system prompt ────────────────────────────────────────────────
  const existingMealJson = JSON.stringify(existingMeal, null, 2);

  const systemPrompt = `You are a clinical nutrition AI that modifies existing meals on behalf of a user.

USER HEALTH PROFILE AND PROTOCOL CONSTRAINTS:
${protocolContext || "No dietary restrictions on file — apply general healthy eating principles."}
${glp1Block ? `\n${glp1Block}` : ""}
${savedGroceriesBlock ? `\n\n${savedGroceriesBlock}` : ""}

EXISTING MEAL (modify this):
${existingMealJson}

MODIFICATION RULES:
1. PRESERVE IDENTITY: Keep the meal recognizable. Only change what the instruction requires.
2. RECALCULATE MACROS: After every modification, recalculate the "macros" object (calories, protein, carbs, fat) to reflect the actual updated ingredients. The "macros" field is REQUIRED — all four values must be numeric.
3. PROTOCOL SAFETY: Never introduce an ingredient that violates the user's allergies, dietary identity, or medical hard limits — even if the user requests it.
4. GLP-1 COMPLIANCE: If GLP-1 is active, the updated meal must stay within the fat ceiling and calorie target. A "make it heartier" request cannot exceed the fat ceiling.
5. DIABETIC COMPLIANCE: If the user has diabetes, keep total carbs within the diabetic meal limit. Prefer protein and fiber increases over starch increases.
6. SAVED GROCERIES: When substituting an ingredient, prefer vetted favorites from the saved grocery list.
7. OUTPUT SCHEMA: Return the complete updated meal in EXACTLY the same JSON schema as the EXISTING MEAL above. Do not add or remove top-level keys.
8. CHANGES SUMMARY: Include a "changesSummary" top-level field (string, 1-3 sentences) explaining what changed and why it is safe.

Return ONLY valid JSON — no markdown, no commentary outside the JSON.`;

  // ── 5. LLM call helper ────────────────────────────────────────────────────
  const callLLM = async (extraInstruction?: string): Promise<Record<string, unknown>> => {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt + (extraInstruction ?? "") },
        { role: "user", content: `Apply this change to the meal: "${changeInstruction}"` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.65,
      max_tokens: 1800,
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error("Meal refinement engine could not parse LLM response. Please try again.");
    }
  };

  // ── 6. First generation ───────────────────────────────────────────────────
  const parsed = await callLLM();

  const changesSummaryRaw =
    typeof parsed.changesSummary === "string" && parsed.changesSummary.trim()
      ? parsed.changesSummary.trim()
      : "Meal updated as requested.";

  const { changesSummary: _s, ...mealRaw } = parsed;

  // ── Schema preservation (initial attempt) ────────────────────────────────
  const { meal: preservedMeal, missingCritical } = applySchemaPreservation(
    mealRaw as Record<string, unknown>,
    existingMeal,
  );

  let workingMeal = preservedMeal;

  const mealNameForScan =
    (workingMeal.name as string | undefined) ??
    ((workingMeal.meal as Record<string, unknown> | undefined)?.name as string | undefined) ??
    "Refined Meal";

  // ── 7. First combined validation pass ────────────────────────────────────
  let validation = validateMeal(workingMeal, mealNameForScan, envelope, glp1Targets, generatorName);

  // Treat missing critical keys as a validation failure so the retry path
  // receives an explicit schema correction instruction.
  if (missingCritical.length > 0) {
    console.warn(
      `⚠️ [MealRefinementEngine] LLM response missing critical schema keys: ${missingCritical.join(", ")} — forcing retry`,
    );
    const schemaInstruction =
      `\n\nSCHEMA CORRECTION: Your response was missing these required top-level fields from the original meal: ${missingCritical.join(", ")}. ` +
      `You MUST include ALL of these fields in your response in exactly the same format as the input meal.`;
    validation = {
      ...validation,
      passed: false,
      correctionInstruction: schemaInstruction + validation.correctionInstruction,
    };
  }

  if (!validation.passed) {
    console.warn(
      `⚠️ [MealRefinementEngine] First pass failed — ` +
      `NDE:${!validation.ndeScan.passed} starch:${validation.starchGateTriggered} ` +
      `glp1:${JSON.stringify(validation.glp1Issues)} missing:${missingCritical.join(",") || "none"} — retrying`,
    );

    let retryParsed: Record<string, unknown>;
    try {
      retryParsed = await callLLM(validation.correctionInstruction);
    } catch (retryErr: any) {
      throw new Error(
        `Could not apply "${changeInstruction}" within your active health protocol. ` +
        `Please try a different modification.`,
      );
    }

    // Capture retry's changesSummary — it describes the retry output, not the
    // initial (rejected) attempt. Use it whenever the retry becomes updatedMeal.
    const retrySummaryRaw =
      typeof retryParsed.changesSummary === "string" && retryParsed.changesSummary.trim()
        ? retryParsed.changesSummary.trim()
        : changesSummaryRaw; // fallback to initial if retry omitted it

    const { changesSummary: _rs, ...retryMealRaw } = retryParsed;

    // ── Schema preservation (retry attempt) ──────────────────────────────
    const { meal: retryPreserved, missingCritical: retryMissingCritical } =
      applySchemaPreservation(retryMealRaw as Record<string, unknown>, existingMeal);

    // Retry missing critical keys is a hard failure — no output escapes without
    // the required schema, even if NDE/GLP-1/starch scans happen to pass.
    if (retryMissingCritical.length > 0) {
      console.error(
        `🚫 [MealRefinementEngine] Retry also missing critical schema keys: ${retryMissingCritical.join(", ")} — blocking`,
      );
      throw new Error(
        `This modification could not be applied while preserving the required meal structure ` +
        `(missing: ${retryMissingCritical.join(", ")}). Please try a different change.`,
      );
    }

    workingMeal = retryPreserved;

    // ── 8. Final combined validation pass (retry result) ──────────────────
    // Every retry goes through the SAME combined check — no retry escapes validation.
    const retryValidation = validateMeal(
      workingMeal,
      mealNameForScan,
      envelope,
      glp1Targets,
      `${generatorName}_retry`,
    );

    if (!retryValidation.passed) {
      if (
        retryValidation.glp1Issues?.fatViolation ||
        retryValidation.glp1Issues?.calViolation ||
        retryValidation.glp1Issues?.absentMacros
      ) {
        throw new Error(
          `PROTOCOL_VIOLATION: Could not apply "${changeInstruction}" within your GLP-1 ` +
          `fat limit (${glp1Targets!.maximumToleratedFatGrams}g). Try a lighter modification.`,
        );
      }

      if (retryValidation.starchGateTriggered) {
        throw new Error(
          `PROTOCOL_VIOLATION: Could not apply "${changeInstruction}" within your diabetic ` +
          `starch limit. Try requesting a lower-carb modification.`,
        );
      }

      const violationMsg = retryValidation.ndeScan.violations
        .map((v: any) => v.reason || v.message || String(v))
        .filter(Boolean)
        .join("; ");

      console.error(
        `🚫 [MealRefinementEngine] Both attempts failed combined validation — blocking. ${violationMsg}`,
      );
      throw new Error(
        `This modification conflicts with your active health protocol and cannot be applied safely. ` +
        `Please try a different change.${violationMsg ? ` (${violationMsg})` : ""}`,
      );
    }

    validation = retryValidation;

    // ── 9. Soft protocol note for GLP-1 protein floor ────────────────────────
    let protocolNote: string | null = null;
    if (validation.glp1Issues?.protFloor && glp1Targets) {
      const macros = extractMacros(workingMeal);
      const prot = macros.protein ?? 0;
      protocolNote =
        `GLP-1 note: The updated meal's protein (${Math.round(prot)}g) is below your target of ` +
        `${glp1Targets.minimumProteinFloor}g. Consider adding a lean protein source.`;
    }

    return {
      updatedMeal: workingMeal,
      changesSummary: retrySummaryRaw,
      protocolNote,
    };
  }

  // ── 9. Soft protocol note for GLP-1 protein floor (initial-pass success) ──
  let protocolNote: string | null = null;
  if (validation.glp1Issues?.protFloor && glp1Targets) {
    const macros = extractMacros(workingMeal);
    const prot = macros.protein ?? 0;
    protocolNote =
      `GLP-1 note: The updated meal's protein (${Math.round(prot)}g) is below your target of ` +
      `${glp1Targets.minimumProteinFloor}g. Consider adding a lean protein source.`;
  }

  return {
    updatedMeal: workingMeal,
    changesSummary: changesSummaryRaw,
    protocolNote,
  };
}

export interface CookingTip {
  tip: string;
  reason?: string;
}

export interface CookingMethodIngredientChange {
  item: string;
  change: string;   // e.g. "reduce quantity by half — method retains moisture"
}

/** Returned by the engine for a "change_cooking_method" refinement. */
export interface CookingMethodResult {
  newMethod: string;
  cookingNotes: string;    // step-by-step or key instructions for the new method
  cookingTips: CookingTip[];
  ingredientChanges: CookingMethodIngredientChange[];
  protocolNote: string | null;
  /**
   * LLM-estimated total meal fat (g) after the method change.
   * Used for GLP-1 fat ceiling enforcement; null when the LLM could not estimate.
   */
  estimatedMealFatGrams: number | null;
}

/**
 * Explicit allergen guard — scans raw text against envelope.allergies.
 * scanGeneratedOutput checks avoidances but not confirmed allergens; this
 * function provides the missing hard-stop check.
 *
 * Each allergen label is expanded using expandAllergenTerms so that category
 * labels (e.g. "Tree Nuts") catch their members (almond, cashew, walnut, …)
 * and not just the literal label string.
 *
 * Returns the first allergen label whose label or any member appears in the
 * text, or null if safe.
 */
export function findAllergenInText(text: string, allergies: string[]): string | null {
  if (!allergies.length || !text) return null;
  const normalized = text.toLowerCase();
  for (const allergen of allergies) {
    if (!allergen) continue;
    for (const term of expandAllergenTerms(allergen)) {
      if (term && normalized.includes(term)) {
        return allergen; // return the original label for the error message
      }
    }
  }
  return null;
}

/**
 * Expands an allergen label into all the ingredient terms that should be
 * blocked in generated text.
 *
 * Normalisation handles:
 *  - Compound labels:  "Wheat/Gluten" → split on "/" → expand both "wheat" and "gluten"
 *  - Qualifier words:  "Lactose Intolerance" → strip "intolerance" → expand "lactose"
 *                      "Nut Allergy" → strip "allergy" → expand "nut"
 *  - Hyphen/space:     "tree-nuts" → "tree nuts" (and vice-versa)
 *  - Singular/plural:  "nuts" → "nut", "nut" → "nuts"
 *
 * The original label is always included so exact literal matches still work.
 */
export function expandAllergenTerms(label: string): string[] {
  const key = label.toLowerCase().trim();
  const collected = new Set<string>([key]);

  /**
   * Look up one normalised key in the taxonomy and add all members to
   * `collected`. Tries several normalised variants of the key.
   */
  const addFromTaxonomy = (k: string) => {
    for (const variant of [
      k,
      k.replace(/-/g, " "),    // "tree-nuts" → "tree nuts"
      k.replace(/\s/g, "-"),   // "tree nuts" → "tree-nuts"
      k.replace(/s$/, ""),     // "nuts" → "nut"
      `${k}s`,                 // "nut" → "nuts"
    ]) {
      collected.add(variant);
      for (const member of ALLERGEN_TAXONOMY[variant] ?? []) {
        collected.add(member);
      }
    }
  };

  // Strip qualifier words that don't affect the allergen category
  // e.g. "Lactose Intolerance" → "lactose", "Nut Allergy" → "nut"
  const QUALIFIERS = /\b(intolerance|allergy|allergies|sensitivity|sensitivities|free|avoidance)\b/g;
  const stripped = key.replace(QUALIFIERS, " ").replace(/\s{2,}/g, " ").trim();

  // Split on "/" "," "&" "+" to handle compound labels like "Wheat/Gluten"
  const parts = stripped.split(/[\/,&+]/).map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    addFromTaxonomy(part);
  }

  // Also try the full stripped key in case it maps directly (e.g. "lactose")
  if (stripped && stripped !== key) {
    addFromTaxonomy(stripped);
  }

  return Array.from(collected).filter(Boolean);
}

export interface MacroImpact {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  summary: string;  // e.g. "+18 g protein, –5 g fat"
}

/** Returned by the engine for an "adjust_macros" refinement. */
export interface MacroAdjustmentResult {
  adjustedIngredients: AdjustedIngredient[];
  macroImpact: MacroImpact;
  coachNote: string;
  protocolNote: string | null;
}

export interface ChangeCookingMethodRequest {
  changeType: "change_cooking_method";
  /** ID of the authenticated user requesting the refinement. */
  userId: string;
  /**
   * Target cooking method, e.g. "air fryer", "slow cooker", "grilled",
   * "baked", "stovetop", "steamed".
   */
  targetMethod: string;
  /** Name of the meal being converted. */
  mealName?: string;
  /** Short description of the meal. */
  mealDescription?: string;
  /** Ingredient list to preserve (quantities may change). */
  currentIngredients?: string[];
  /** Current cooking method, if known (adds context). */
  currentMethod?: string;
}
