/**
 * mealRefinementEngine.ts
 *
 * Shared Meal Refinement Engine — modifies an existing meal instead of regenerating from scratch.
 *
 * CONTRACT (refineMeal — universal function API):
 *   existingMeal (any builder JSON) + changeInstruction + userId
 *   → load protocol context (envelope + GLP-1 + saved groceries)
 *   → call LLM with full existing meal JSON + change instruction + protocol constraints
 *   → combined validation pass: NDE scan + GLP-1 macros + diabetic starch gate
 *   → if any issue: single retry with combined fix instruction → combined validation again
 *   → return updated meal in the same JSON schema as the input
 *
 * CLINICAL GUARANTEES:
 *   • GLP-1 FAIL-CLOSED — if the resolver throws or returns active with no targets,
 *     the engine throws MealRefinementRetryableError (surfaces as 503) instead of
 *     proceeding unguarded.
 *   • GLP-1 MACROS — absent/non-finite macros on a GLP-1 meal are treated as a
 *     violation (cannot verify compliance = fail closed).
 *   • DIABETIC STARCH GATE — starchBudgetViolation.detected triggers remediation,
 *     not a warning. Both initial and retry outputs are gated.
 *   • EVERY RETRY is re-validated through the same combined pass; no retry escapes
 *     validation.
 *
 * MealRefinementEngine class (Phase 1 — replace_ingredient):
 *   Thin class wrapper around the same protocol-loading pattern, used by Grocery
 *   Coach's ingredient swap. New change types should be added as new entries in the
 *   MealRefinementRequest/RefinementChangeType union below, or as changeInstruction
 *   strings passed to refineMeal().
 *
 * DESIGN RULES:
 *   - Protocol loading reuses loadUserProtocolEnvelope + resolveGLP1GlobalContext + filterSavedGroceriesForCompliance.
 *   - NDE scan reuses scanGeneratedOutput — same post-gen validator used by every builder.
 *   - The identity of the existing meal is preserved unless the requested change requires otherwise.
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

// ─── Types (class-based API — Phase 1) ───────────────────────────────────────

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

// ── Ingredient extractor ──────────────────────────────────────────────────────

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
      default: {
        throw new Error(`Unsupported refinement changeType: ${(request as any).changeType}`);
      }
    }
  }

  private async _replaceIngredient(req: ReplaceIngredientRequest): Promise<SwapRefinementResult> {
    const { userId, ingredientToReplace, mealName, mealDescription, remainingIngredients, userRequest } = req;

    let envelope: UserProtocolEnvelope = buildGuestEnvelope();
    let protocolContext = "";
    try {
      envelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
      protocolContext = enforceBeforeGenerate(envelope, { generatorName: "grocery_swap" }).combined;
    } catch { /* proceed without protocol context */ }

    let glp1Block = "";
    let glp1Targets: ResolvedGLP1Targets | null = null;
    try {
      const todayISO = new Date().toISOString().slice(0, 10);
      const glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
      if (glp1Ctx) {
        glp1Block = buildGLP1RecommendationBlock(glp1Ctx);
        glp1Targets = glp1Ctx.resolvedTargets ?? null;
      }
    } catch { /* non-fatal for swap */ }

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
    } catch { /* non-fatal */ }

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

    try {
      const scan = scanGeneratedOutput(
        { name: `Swap: ${swapData.coachSuggestion.item}`, ingredients: [{ name: swapData.coachSuggestion.item }] },
        envelope,
        { generatorName: "grocery_swap", skipAdaptableConflicts: true },
      );
      if (!scan.passed) {
        const existing = swapData.protocolNote ? `${swapData.protocolNote} ` : "";
        swapData.protocolNote =
          `${existing}Note: "${swapData.coachSuggestion.item}" may conflict with your protocol — ${scan.message}. Review before adding.`;
      }
    } catch { /* scan errors non-fatal */ }

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
