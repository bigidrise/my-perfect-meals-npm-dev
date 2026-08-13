/**
 * Meal Refinement Route — POST /api/meal-refinement/refine
 *
 * Takes a generated meal + a refinement request (chip text or free text)
 * and returns an improved version that still passes the full protocol stack.
 *
 * SECURITY: Fail-closed for authenticated users — if the protocol envelope
 * cannot be loaded the request is rejected with 503 rather than silently
 * falling back to the permissive guest envelope, which would bypass the
 * user's clinical/dietary restrictions.
 */

import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../middleware/requireAuth";
import { requireActiveAccess } from "../middleware/requireActiveAccess";
import {
  loadUserProtocolEnvelope,
  enforceBeforeGenerate,
  scanGeneratedOutput,
  buildGuestEnvelope,
} from "../services/protocolEnvelope";
import { getAuthUserId } from "../utils/getAuthUserId";
import { resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";
import { findAllergenInText, extractIngredientNames } from "../services/mealRefinementEngine";

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

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

router.post(
  "/refine",
  requireAuth,
  requireActiveAccess,
  async (req: any, res: any) => {
    try {
      const { meal, request: refinementRequest, builderType } = req.body;

      if (!meal || typeof meal !== "object") {
        return res.status(400).json({ error: "meal is required" });
      }
      if (!refinementRequest || typeof refinementRequest !== "string") {
        return res.status(400).json({ error: "request is required" });
      }

      const userId = getAuthUserId(req as any);

      // Load protocol envelope.
      // For authenticated users, a failed load is a hard error — we must not
      // silently fall back to the guest envelope and generate a meal that
      // could violate their allergies or medical restrictions.
      let envelope = buildGuestEnvelope();
      let protocolContext = "";
      if (userId) {
        let loaded;
        try {
          loaded = await loadUserProtocolEnvelope(userId);
        } catch (envelopeErr) {
          console.error("[MealRefinement] Protocol envelope load failed for authenticated user:", envelopeErr);
          return res.status(503).json({
            error: "Could not load your dietary profile. Please try again in a moment.",
          });
        }
        if (!loaded) {
          return res.status(503).json({
            error: "Could not load your dietary profile. Please try again in a moment.",
          });
        }
        envelope = loaded;
        try {
          const enforced = enforceBeforeGenerate(envelope, {
            generatorName: "meal_refinement",
          });
          protocolContext = enforced.combined;
        } catch (enforceErr) {
          console.error("[MealRefinement] Protocol enforcement failed:", enforceErr);
          return res.status(503).json({
            error: "Could not apply your dietary rules. Please try again in a moment.",
          });
        }
      }

      // ── GLP-1 context — fail-closed for active GLP-1 users ─────────────────
      // Must resolve before generation so the system prompt carries fat/calorie
      // ceilings, and post-gen macro validation can enforce them.
      let glp1Targets: import("../services/glp1/resolveGLP1MealTargets").ResolvedGLP1Targets | null = null;
      if (userId) {
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
            error: "GLP-1 macro targets are unavailable. Please try again.",
            retryable: true,
          });
        }
        glp1Targets = glp1Ctx.isActive ? glp1Ctx.resolvedTargets : null;
      }

      // Build a readable summary of the original meal
      const name = meal.name ?? meal.title ?? "Unknown Meal";
      const description = meal.description ?? "";
      const ingredients = summarizeIngredients(meal.ingredients ?? []);
      const instructions = summarizeInstructions(
        meal.instructions ?? meal.cookingInstructions
      );
      // Support both standard (protein/carbs/fat) and _g-suffixed (protein_g/carbs_g/fat_g)
      // schema variants so MealCardFull meals (which use _g fields) produce accurate context.
      const nutrition = meal.nutrition
        ? `${meal.nutrition.calories ?? 0} cal, ${meal.nutrition.protein ?? meal.nutrition.protein_g ?? 0}g protein, ${meal.nutrition.carbs ?? meal.nutrition.carbs_g ?? 0}g carbs, ${meal.nutrition.fat ?? meal.nutrition.fat_g ?? 0}g fat`
        : `${meal.calories ?? 0} cal, ${meal.protein ?? meal.protein_g ?? 0}g protein, ${meal.carbs ?? meal.carbs_g ?? 0}g carbs, ${meal.fat ?? meal.fat_g ?? 0}g fat`;
      const servings = meal.servings ?? meal.servingCount ?? 2;
      const cookingTime = meal.cookingTime ?? meal.prepTime ?? "";
      const difficulty = meal.difficulty ?? "";

      const glp1PromptBlock = glp1Targets
        ? `\nGLP-1 CLINICAL PROTOCOL (absolute hard limits — never exceed):\n- Fat per serving MUST be ≤ ${glp1Targets.maximumToleratedFatGrams}g\n- Calories per serving MUST be ≤ ${glp1Targets.resolvedMealCalories} kcal\n- Use only lean proteins and non-oily cooking methods. No fried preparations, heavy oils, avocado, full-fat dairy, or fatty cuts.\n`
        : "";

      const systemPrompt = `You are a precision nutrition coach refining an existing meal based on a user's request. Make the minimum change needed to honour the request while keeping the spirit of the original dish. Return a complete, improved meal.

ACTIVE PROTOCOL CONSTRAINTS (non-negotiable — never violate even if the user asks):
${protocolContext || "No special dietary restrictions on file — apply general healthy eating principles."}${glp1PromptBlock}

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

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
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

      // Normalize name + title so all consumers get both fields
      if (!refined.name && refined.title) refined.name = refined.title;
      if (!refined.title && refined.name) refined.title = refined.name;

      // ── Confirmed-allergen guard ──────────────────────────────────────────────
      // Uses the same ALLERGEN_TAXONOMY expansion as MealRefinementEngine so that
      // compound labels (e.g. "tree nuts") catch member species (e.g. "almond").
      // scanGeneratedOutput does NOT walk envelope.allergies directly, so this
      // check must be explicit.
      const refinedIngredientText = extractIngredientNames(refined as Record<string, unknown>).join(" ");
      const allergenHit = findAllergenInText(
        `${refined.name ?? ""} ${refined.description ?? ""} ${refinedIngredientText}`,
        (envelope as any).allergies ?? [],
      );
      if (allergenHit) {
        return res.status(422).json({
          error: `The refined meal contains ${allergenHit}, which conflicts with your active allergen restrictions. Please try a different refinement.`,
        });
      }

      // ── GLP-1 post-gen macro validation ──────────────────────────────────────
      if (glp1Targets) {
        const t = glp1Targets;
        const fat = Number(refined.nutrition?.fat ?? refined.fat ?? refined.fat_g);
        const cal = Number(refined.nutrition?.calories ?? refined.calories);
        const fatViolation = Number.isFinite(fat) && fat > t.maximumToleratedFatGrams;
        const calViolation = Number.isFinite(cal) && cal > t.resolvedMealCalories * 1.25;
        if (fatViolation || calViolation) {
          const detail = [
            fatViolation ? `fat: ${fat}g (limit ${t.maximumToleratedFatGrams}g)` : "",
            calViolation ? `calories: ${cal} (limit ~${t.resolvedMealCalories} kcal)` : "",
          ].filter(Boolean).join(", ");
          return res.status(422).json({
            error: `The refined meal exceeds your GLP-1 clinical limits (${detail}). Try requesting a lighter preparation.`,
          });
        }
      }

      // Protocol scan on refined output
      const scanMeal = {
        name: refined.name ?? "",
        description: refined.description ?? "",
        ingredients: (refined.ingredients ?? []).map((i: any) => ({
          name: typeof i === "string" ? i : (i.name ?? i.item ?? ""),
          amount:
            typeof i === "string"
              ? 1
              : (i.quantity ?? i.amount ?? 1),
          unit: typeof i === "string" ? "" : (i.unit ?? ""),
        })),
        instructions: refined.instructions,
      };

      const scan = scanGeneratedOutput(scanMeal, envelope, {
        generatorName: "meal_refinement",
        skipAdaptableConflicts: false,
      });

      // Reject any failed scan — this covers both ingredient violations (violations array)
      // and instruction-only violations (passed: false, empty violations array).
      if (!scan.passed) {
        return res.status(422).json({
          error:
            "The refined meal conflicts with your active dietary protocol. Please try a different refinement.",
          ndeSummary: scan.message,
        });
      }

      // Merge refined fields back, preserving original metadata that wasn't changed
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
        // Normalize name/title so MealCard (which renders title || name) always shows the new name
        name: refinedName,
        title: refinedName,
        // imageUrl intentionally omitted — parent decides whether to regenerate
        imageUrl: undefined,
      };

      return res.json({
        meal: result,
        refinementApplied: refinementRequest,
      });
    } catch (err: any) {
      console.error("[MealRefinement] Error:", err);
      return res
        .status(500)
        .json({ error: "Refinement failed. Please try again." });
    }
  }
);

export default router;
