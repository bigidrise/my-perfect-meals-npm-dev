/**
 * Meal Refinement Route — POST /api/meal-refinement/refine
 *
 * Takes a generated meal + a refinement request (chip text or free text)
 * and returns an improved version that still passes the full protocol stack.
 *
 * Safety guarantees:
 *   • Protocol envelope — fail-closed: 503 when the user's profile cannot be
 *     loaded (throw or null), never silently falling back to the guest envelope.
 *   • GLP-1 macro gate — when GLP-1 is active, fat and calories must be finite
 *     and within limits; absent macros are treated as violations (fail-closed).
 *     Resolver unavailability → 503 for ALL users (resolver is the only reliable
 *     source of GLP-1 activation state; glp1DailyTolerance is not a safe proxy).
 *   • Diabetic carb gate — when envelope.hasDiabetes, carbs must be finite and
 *     within the per-meal ceiling; absent carbs are treated as violations.
 *   • Combined validation runs after EVERY attempt (initial + retry) — no
 *     attempt escapes validation, and both gates are checked together.
 *   • Hard allergen/avoidance NDE scan — checked on every attempt; 422 if both
 *     fail. Uses `!scan.passed` (not `violations.length > 0`) so instruction-only
 *     violations (passed:false, empty violations array) are also caught.
 */

import { Router } from "express";
import OpenAI from "openai";
import { getLanguageInstruction } from "../utils/languageInstruction";
import { requireAuth } from "../middleware/requireAuth";
import { requireActiveAccess } from "../middleware/requireActiveAccess";
import {
  loadUserProtocolEnvelope,
  enforceBeforeGenerate,
  scanGeneratedOutput,
  buildGuestEnvelope,
} from "../services/protocolEnvelope";
import {
  resolveGLP1GlobalContext,
  buildGLP1RecommendationBlock,
} from "../services/glp1/resolveGLP1GlobalContext";
import type { ResolvedGLP1Targets } from "../services/glp1/resolveGLP1MealTargets";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getAuthUserId } from "../utils/getAuthUserId";

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flatten a meal's ingredient list to a readable string for the prompt. */
function summarizeIngredients(ingredients: any[]): string {
  return ingredients
    .map((i) => {
      if (typeof i === "string") return i;
      const qty = i.quantity ?? i.amount ?? "";
      const unit = i.unit ?? "";
      const name = i.name ?? i.item ?? "ingredient";
      return [qty, unit, name].filter(Boolean).join(" ").trim();
    })
    .join(", ");
}

/** Flatten instructions to a readable string for the prompt. */
function summarizeInstructions(instructions: any): string {
  if (!instructions) return "";
  if (typeof instructions === "string") return instructions.slice(0, 500);
  if (Array.isArray(instructions)) {
    return instructions
      .map((s, i) => {
        const text = typeof s === "string" ? s : s.step ?? s.text ?? JSON.stringify(s);
        return `${i + 1}. ${text}`;
      })
      .join(" ")
      .slice(0, 500);
  }
  return "";
}

/**
 * Extract numeric macro values from a refined meal response.
 * Looks in `refined.nutrition` first (MealCardFull schema), then `refined` top-level.
 * Returns null for any value that is absent, non-finite, or negative.
 */
function extractNutrition(refined: any): {
  fat: number | null;
  calories: number | null;
  carbs: number | null;
  protein: number | null;
} {
  const nut =
    refined.nutrition && typeof refined.nutrition === "object" ? refined.nutrition : refined;
  const toN = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    fat: toN(nut.fat ?? nut.fat_g),
    calories: toN(nut.calories),
    carbs: toN(nut.carbs ?? nut.carbs_g),
    protein: toN(nut.protein ?? nut.protein_g),
  };
}

/** Build the scan-ready meal object from a parsed AI response. */
function buildScanMeal(refined: any) {
  return {
    name: refined.name ?? refined.title ?? "",
    description: refined.description ?? "",
    ingredients: (refined.ingredients ?? []).map((i: any) => ({
      name: typeof i === "string" ? i : (i.name ?? i.item ?? ""),
      amount: typeof i === "string" ? 1 : (i.quantity ?? i.amount ?? 1),
      unit: typeof i === "string" ? "" : (i.unit ?? ""),
    })),
    instructions: refined.instructions,
  };
}

interface ValidationOutcome {
  passed: boolean;
  glp1Block: boolean;
  diabeticBlock: boolean;
  scanBlock: boolean;
  correctionInstruction: string;
  ndeSummary: string;
}

/**
 * Combined validation: GLP-1 macro gate + diabetic carb gate + NDE scan.
 * All gates are evaluated together; the combined correction is returned for retry.
 * Absent required macros are treated as violations (fail-closed).
 */
function validateRefined(
  refined: any,
  envelope: ReturnType<typeof buildGuestEnvelope>,
  glp1Targets: ResolvedGLP1Targets | null,
  diabeticCarbCeiling: number | null,
  generatorName: string,
): ValidationOutcome {
  const { fat, calories, carbs } = extractNutrition(refined);
  const corrections: string[] = [];
  let glp1Block = false;
  let diabeticBlock = false;

  // ── GLP-1 gate ──────────────────────────────────────────────────────────────
  if (glp1Targets) {
    // Absent fat → fail-closed (cannot verify compliance)
    if (fat === null) {
      glp1Block = true;
      corrections.push(
        `You MUST include a numeric fat value ≤ ${glp1Targets.maximumToleratedFatGrams}g in the nutrition output`,
      );
    } else if (fat > glp1Targets.maximumToleratedFatGrams) {
      glp1Block = true;
      corrections.push(
        `Fat is ${fat}g — it MUST be ≤ ${glp1Targets.maximumToleratedFatGrams}g for this GLP-1 patient`,
      );
    }
    // Absent calories → fail-closed (cannot verify compliance)
    if (calories === null) {
      glp1Block = true;
      corrections.push(
        `You MUST include a numeric calories value ≤ ${glp1Targets.resolvedMealCalories} kcal in the nutrition output`,
      );
    } else if (calories > glp1Targets.resolvedMealCalories * 1.25) {
      glp1Block = true;
      corrections.push(
        `Calories are ${Math.round(calories)} — they MUST be ≤ ${glp1Targets.resolvedMealCalories} kcal`,
      );
    }
  }

  // ── Diabetic carb gate ──────────────────────────────────────────────────────
  if (diabeticCarbCeiling !== null) {
    if (carbs === null) {
      diabeticBlock = true;
      corrections.push(
        `You MUST include a numeric carbs value ≤ ${diabeticCarbCeiling}g in the nutrition output`,
      );
    } else if (carbs > diabeticCarbCeiling) {
      diabeticBlock = true;
      corrections.push(
        `Carbs are ${carbs}g — they MUST be ≤ ${diabeticCarbCeiling}g per meal for this diabetic patient`,
      );
    }
  }

  // ── NDE allergen/avoidance scan ─────────────────────────────────────────────
  const scan = scanGeneratedOutput(buildScanMeal(refined), envelope, {
    generatorName,
    skipAdaptableConflicts: false,
  });

  let scanNdeSummary = "";
  if (!scan.passed) {
    const violationMsg = (scan.violations ?? [])
      .map((v: any) => v.reason || v.message || String(v))
      .filter(Boolean)
      .join("; ");
    scanNdeSummary = violationMsg || scan.message || "Protocol violation detected.";
    const violatingTerms = (scan.violations ?? []).map((v: any) => v.term).filter(Boolean);
    const exclusionClause =
      violatingTerms.length > 0
        ? `"${violatingTerms.join('", "')}" (${scan.primaryViolation?.reason ?? "conflicts with active dietary protocol"})`
        : "the previously suggested ingredients (they conflict with the active dietary protocol)";
    corrections.push(
      `CRITICAL CORRECTION — Do NOT include ${exclusionClause}. ` +
        `Recommend a fully compliant alternative that meets all active health protocols.`,
    );
  }

  const passed = !glp1Block && !diabeticBlock && scan.passed;
  const correctionInstruction =
    corrections.length > 0
      ? `\n\nCRITICAL CORRECTIONS REQUIRED:\n${corrections.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
      : "";

  // Combined ndeSummary for error responses
  const ndeParts: string[] = [];
  if (glp1Block) ndeParts.push("GLP-1 fat/calorie limit exceeded or not verifiable");
  if (diabeticBlock) ndeParts.push("Diabetic carb limit exceeded or not verifiable");
  if (!scan.passed) ndeParts.push(scanNdeSummary);
  const ndeSummary = ndeParts.join("; ");

  return {
    passed,
    glp1Block,
    diabeticBlock,
    scanBlock: !scan.passed,
    correctionInstruction,
    ndeSummary,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/refine", requireAuth, requireActiveAccess, async (req: any, res: any) => {
  try {
    const { meal, request: refinementRequest, builderType } = req.body;

    if (!meal || typeof meal !== "object") {
      return res.status(400).json({ error: "meal is required" });
    }
    if (!refinementRequest || typeof refinementRequest !== "string") {
      return res.status(400).json({ error: "request is required" });
    }

    const userId = getAuthUserId(req as any);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // ── 1. Protocol envelope — FAIL-CLOSED ─────────────────────────────────
    // A failed or null load must NEVER silently fall back to the guest
    // envelope — that would bypass the user's allergies and medical restrictions.
    let envelope: ReturnType<typeof buildGuestEnvelope>;
    let protocolContext = "";

    try {
      const loaded = await loadUserProtocolEnvelope(userId);
      if (!loaded) {
        return res.status(503).json({
          error: "Could not load your dietary profile. Please try again in a moment.",
        });
      }
      envelope = loaded;
      try {
        const enforced = enforceBeforeGenerate(envelope, { generatorName: "meal_refinement" });
        protocolContext = enforced.combined;
      } catch (enforceErr) {
        console.error("[MealRefinement] Protocol enforcement failed:", enforceErr);
        return res.status(503).json({
          error: "Could not apply your dietary rules. Please try again in a moment.",
        });
      }
    } catch {
      return res.status(503).json({
        error: "Could not load your dietary profile. Please try again in a moment.",
      });
    }

    // ── 2. GLP-1 canonical context — FAIL-CLOSED FOR ALL USERS ────────────
    // The resolver is the only reliable source of GLP-1 activation state.
    // Envelope fields like glp1DailyTolerance are set by a separate process
    // that can fail independently, so they are not a reliable proxy.
    // A null result (throw or explicit null) means we cannot determine whether
    // the user is on GLP-1 medication — we MUST block rather than proceed.
    let glp1Targets: ResolvedGLP1Targets | null = null;
    let glp1Block = "";

    const todayISO = new Date().toISOString().slice(0, 10);
    const glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);

    if (glp1Ctx === null) {
      return res.status(503).json({
        error: "Clinical guidance temporarily unavailable. Please try again.",
        retryable: true,
      });
    }

    if (glp1Ctx.isActive && !glp1Ctx.resolvedTargets) {
      return res.status(503).json({
        error: "GLP-1 clinical targets temporarily unavailable. Please try again.",
        retryable: true,
      });
    }

    if (glp1Ctx.isActive && glp1Ctx.resolvedTargets) {
      glp1Targets = glp1Ctx.resolvedTargets;
      glp1Block = buildGLP1RecommendationBlock(glp1Ctx);
    }

    // ── 3. Diabetic per-meal carb ceiling ───────────────────────────────────
    let diabeticCarbCeiling: number | null = null;
    if (envelope.hasDiabetes) {
      try {
        const [row] = await db
          .select({ dailyCarbsTarget: users.dailyCarbsTarget })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const dailyCarbs = row?.dailyCarbsTarget;
        diabeticCarbCeiling = dailyCarbs && dailyCarbs > 0 ? Math.round(dailyCarbs / 3) : 45;
      } catch {
        // Non-critical — use the conservative 45 g default
        diabeticCarbCeiling = 45;
      }
    }

    // ── 4. Build prompt ─────────────────────────────────────────────────────
    const rawLang = (req as any).authUser?.preferredLanguage || "auto";
    const langInstruction = getLanguageInstruction(rawLang);
    const name = meal.name ?? meal.title ?? "Unknown Meal";
    const description = meal.description ?? "";
    const ingredients = summarizeIngredients(meal.ingredients ?? []);
    const instructions = summarizeInstructions(meal.instructions ?? meal.cookingInstructions);
    const nutrition = meal.nutrition
      ? `${meal.nutrition.calories ?? 0} cal, ${meal.nutrition.protein ?? meal.nutrition.protein_g ?? 0}g protein, ${meal.nutrition.carbs ?? meal.nutrition.carbs_g ?? 0}g carbs, ${meal.nutrition.fat ?? meal.nutrition.fat_g ?? 0}g fat`
      : `${meal.calories ?? 0} cal, ${meal.protein ?? meal.protein_g ?? 0}g protein, ${meal.carbs ?? meal.carbs_g ?? 0}g carbs, ${meal.fat ?? meal.fat_g ?? 0}g fat`;
    const servings = meal.servings ?? meal.servingCount ?? 2;
    const cookingTime = meal.cookingTime ?? meal.prepTime ?? "";
    const difficulty = meal.difficulty ?? "";
    const genName = builderType ? `meal_refinement_${builderType}` : "meal_refinement";

    const buildSystemPrompt = (extraConstraint = "") =>
      `${langInstruction ? langInstruction + "\n\n" : ""}You are a precision nutrition coach refining an existing meal based on a user's request. Make the minimum change needed to honour the request while keeping the spirit of the original dish. Return a complete, improved meal.

ACTIVE PROTOCOL CONSTRAINTS (non-negotiable — never violate even if the user asks):
${protocolContext || "No special dietary restrictions on file — apply general healthy eating principles."}
${glp1Block ? `\n${glp1Block}` : ""}${extraConstraint}

RULES:
- Keep the same meal style and approximate macros unless the request explicitly targets them.
- Only change what the user requests — preserve everything else.
- All protocol constraints are absolute hard limits.
- Preserve the serving count (${servings} servings) unless asked to change it.
- Return ONLY valid JSON — no markdown, no explanation, no extra text outside the JSON object.

OUTPUT FORMAT (all fields required):
{
  "name": "Refined meal name",
  "title": "Refined meal name",
  "description": "Updated description reflecting the change",
  "ingredients": [
    { "name": "ingredient", "quantity": 1, "unit": "cup", "category": "Produce" }
  ],
  "instructions": ["Step 1…", "Step 2…"],
  "nutrition": { "calories": 450, "protein": 35, "carbs": 40, "fat": 14 },
  "servings": ${servings},
  "cookingTime": "${cookingTime || "25 min"}",
  "difficulty": "${difficulty || "Easy"}"
}`;

    const userPrompt = `ORIGINAL MEAL:
Name: ${name}
Description: ${description}
Ingredients: ${ingredients}
Instructions: ${instructions}
Nutrition (${servings} servings): ${nutrition}
${builderType ? `Builder type: ${builderType}` : ""}

USER'S REFINEMENT REQUEST: "${refinementRequest}"

Refine this meal per the request. Return only the JSON object.`;

    // ── 5. Initial generation ───────────────────────────────────────────────
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1600,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return res.status(500).json({ error: "No response from AI" });
    }

    let refined: any;
    try {
      refined = JSON.parse(rawContent);
    } catch {
      return res.status(500).json({ error: "AI returned an invalid response" });
    }

    // Normalize name ↔ title so MealCard always has both
    if (!refined.name && refined.title) refined.name = refined.title;
    if (!refined.title && refined.name) refined.title = refined.name;

    // ── 6. First combined validation pass ───────────────────────────────────
    let validation = validateRefined(refined, envelope, glp1Targets, diabeticCarbCeiling, genName);

    // ── 7. Retry if needed (one attempt) ────────────────────────────────────
    if (!validation.passed) {
      console.warn(
        `⚠️ [MealRefinement] First pass failed (glp1:${validation.glp1Block} diabetic:${validation.diabeticBlock} scan:${validation.scanBlock}) — retrying`,
      );

      let retryRefined: any;
      try {
        const retryCompletion = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: buildSystemPrompt(validation.correctionInstruction) },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.6,
          max_tokens: 1600,
          response_format: { type: "json_object" },
        });
        const retryRaw = retryCompletion.choices[0]?.message?.content;
        if (!retryRaw) throw new Error("empty retry response");
        retryRefined = JSON.parse(retryRaw);
        if (!retryRefined.name && retryRefined.title) retryRefined.name = retryRefined.title;
        if (!retryRefined.title && retryRefined.name) retryRefined.title = retryRefined.name;
      } catch (retryErr: any) {
        console.warn("[MealRefinement] Retry request failed:", retryErr?.message);
        // Fall through — validation still holds the initial failure
      }

      // ── 8. Final combined validation pass (retry result) ──────────────────
      // Every retry goes through the SAME combined check — no retry escapes.
      if (retryRefined) {
        validation = validateRefined(
          retryRefined,
          envelope,
          glp1Targets,
          diabeticCarbCeiling,
          `${genName}_retry`,
        );
        if (validation.passed) {
          console.log("✅ [MealRefinement] Retry passed combined validation.");
          refined = retryRefined;
        }
      }
    }

    // ── 9. Hard block if both attempts failed ────────────────────────────────
    if (!validation.passed) {
      if (validation.glp1Block || validation.diabeticBlock) {
        console.error(
          `🚫 [MealRefinement] Both attempts failed clinical macro gates — blocking. ${validation.ndeSummary}`,
        );
        return res.status(400).json({
          error: "PROTOCOL_VIOLATION",
          message: validation.glp1Block
            ? `Could not refine this meal within your GLP-1 fat limit. Try asking for a lower-fat option.`
            : `Could not refine this meal within your diabetic carb limit. Try asking for a lower-carb option.`,
          retryable: true,
        });
      }
      // NDE scan failure
      console.error(
        `🚫 [MealRefinement] Both attempts failed NDE scan — blocking. ${validation.ndeSummary}`,
      );
      return res.status(422).json({
        error:
          "The refined meal conflicts with your active dietary protocol. Please try a different refinement.",
        ndeSummary: validation.ndeSummary,
      });
    }

    // ── 10. Assemble response ───────────────────────────────────────────────
    const refinedName = refined.name ?? meal.name ?? meal.title ?? "Refined Meal";
    const result = {
      // Carry forward original non-content metadata
      id: meal.id,
      savedMealId: meal.savedMealId,
      builderType: meal.builderType ?? builderType,
      dietClassification: meal.dietClassification,
      medicalBadges: meal.medicalBadges,
      appliedProtocol: meal.appliedProtocol,
      diabeticMemory: meal.diabeticMemory,
      entryType: meal.entryType,
      // Apply refined content
      ...refined,
      // Normalize name/title so MealCard always shows the updated name
      name: refinedName,
      title: refinedName,
      // imageUrl is intentionally omitted — parent decides whether to regenerate
      imageUrl: undefined,
    };

    return res.json({
      meal: result,
      refinementApplied: refinementRequest,
      changesSummary: `Refinement applied: "${refinementRequest}"`,
      protocolNote: null,
    });
  } catch (err: any) {
    console.error("[MealRefinement] Error:", err);
    return res.status(500).json({ error: "Refinement failed. Please try again." });
  }
});

export default router;
