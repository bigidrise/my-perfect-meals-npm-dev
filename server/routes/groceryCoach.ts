import express from "express";
import OpenAI from "openai";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope, scanGeneratedOutput } from "../services/protocolEnvelope";
import { resolveGLP1GlobalContext, buildGLP1RecommendationBlock } from "../services/glp1/resolveGLP1GlobalContext";
import { getProductAdvisorEngine } from "../services/productAdvisor";
import { finalizeMealCard } from "../services/mealCardFinalizer";

const router = express.Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id || (req.session as any)?.userId || req.user?.id;
}

router.post("/recommend", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { message, conversationHistory = [], servingCount } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    // Auth is enforced by requireAuth + requireProAccess at the router mount.
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const finalServingCount = Math.max(1, Math.min(12, Number(servingCount) || 1));
    let protocolContext = "";
    let macroContext = "";
    let groceryEnvelope = buildGuestEnvelope();
    let glp1RecommendationBlock = "";

    if (userId) {
      // Use the same full 5-tier constraint package every other builder uses.
      // This covers: dietary identity, allergies (hard-stop), medical hard limits,
      // condition guidance blocks (GLP-1, oncology, pregnancy, thyroid, etc.),
      // palate preferences, sweetener rules, procedural/cross-contamination rules,
      // and performance nutrition overlay.
      groceryEnvelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
      protocolContext = enforceBeforeGenerate(groceryEnvelope, { generatorName: "grocery_coach" }).combined;

      // Load GLP-1 canonical context — covers all activation sources
      // (selectedMealBuilder, medicalConditions, specialtyConditions, glp1_profile, and others)
      const todayISO = new Date().toISOString().slice(0, 10);
      const glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
      if (glp1Ctx) glp1RecommendationBlock = buildGLP1RecommendationBlock(glp1Ctx);

      const [userRow] = await db
        .select({
          dailyCalorieTarget: users.dailyCalorieTarget,
          dailyProteinTarget: users.dailyProteinTarget,
          dailyFatTarget: users.dailyFatTarget,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userRow?.dailyCalorieTarget) {
        const parts = [`${userRow.dailyCalorieTarget} cal/day`];
        if (userRow.dailyProteinTarget) parts.push(`${userRow.dailyProteinTarget}g protein`);
        if (userRow.dailyFatTarget) parts.push(`${userRow.dailyFatTarget}g fat`);
        macroContext = `Daily macro targets: ${parts.join(", ")}`;
      }
    }

    const systemPrompt = `You are a Grocery Store Coach — a real, confident nutrition coach who helps users decide exactly what to make for dinner and what to buy at the grocery store. You are NOT a recipe generator or meal builder. You are a decision-making assistant.

Your mission: turn "I don't know what to eat" into "Here is exactly what to buy, how much to buy, and why it fits your goals."

USER HEALTH PROFILE AND CONSTRAINTS:
${protocolContext || "No dietary restrictions or conditions on file — apply general healthy eating principles."}
${glp1RecommendationBlock ? `\n${glp1RecommendationBlock}` : ""}
${macroContext ? `\n${macroContext}` : ""}

SERVING SIZE: All ingredient quantities must be scaled for ${finalServingCount} ${finalServingCount === 1 ? "person" : "people"}.

COACHING RULES:
- MOST IMPORTANT: If the user mentions ingredients they already bought or have at home, BUILD THE MEAL AROUND THOSE INGREDIENTS. They are the anchor. Only add to the shopping list what is genuinely missing to complete the dish. Never suggest a meal that ignores or sidelines what the user says they already have. Exception: if using a stated ingredient would violate a safety, allergy, clinical, dietary, or protocol constraint, explain the conflict clearly and offer the closest safe alternative — do not silently swap it out.
- Recommend ONE specific, confident meal (may have 2-3 components, e.g., protein + starch + vegetable).
- The shopping list must be practical and grocery-store ready — include realistic quantities with units (e.g., "2 lbs", "1 bunch", "1 can"). Do NOT list ingredients the user said they already have — they already own those.
- The reasoning bullets must directly reference THIS user's conditions, goals, allergies, or macros — not generic health claims.
- Never include ingredients the user is allergic to or avoids.
- If the user asks for a refinement ("make it cheaper", "more protein", "faster", "vegetarian", etc.) — adjust accordingly.
- Be concise, warm, and coach-like — not clinical, not robotic.
- Each follow-up suggestion chip must be a short actionable phrase (3–5 words max).

Respond ONLY with valid JSON matching this exact schema (no markdown, no extra text):
{
  "meal": {
    "name": "string",
    "description": "string — 1-2 sentences",
    "prepTime": "string — e.g. '25 minutes'",
    "servings": number
  },
  "reasoning": ["string", "string", "string"],
  "macros": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  },
  "ownedIngredients": [
    {
      "item": "string — ingredient the user already owns",
      "quantity": "string",
      "unit": "string"
    }
  ],
  "shoppingList": [
    {
      "item": "string",
      "quantity": "string — e.g. '2'",
      "unit": "string — e.g. 'lbs' or 'bunch' or 'can'",
      "category": "Produce|Meat|Plant Proteins|Dairy & Eggs|Grains & Packaged|Pantry|Frozen|Other"
    }
  ],
  "followUpSuggestions": ["string", "string", "string"]
}`;

    const priorMessages = (conversationHistory as any[])
      .slice(-8)
      .filter((m: any) => m.role && m.content);

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...priorMessages,
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 1400,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Could not parse coach response. Try again." });
    }

    // ── Full schema validation ────────────────────────────────────────────────
    // Validates the complete CoachResult contract so neither the initial
    // response nor a retry is ever returned with missing or wrong-typed fields.
    // Returns a human-readable reason string, or null when the payload is valid.
    function invalidReason(r: any): string | null {
      if (r == null || typeof r !== "object") return "response is not an object";
      // meal
      if (!r.meal || typeof r.meal !== "object")          return "missing meal object";
      if (typeof r.meal.name !== "string" || !r.meal.name.trim()) return "missing meal.name";
      if (typeof r.meal.description !== "string")         return "missing meal.description";
      if (typeof r.meal.prepTime !== "string")            return "missing meal.prepTime";
      if (typeof r.meal.servings !== "number")            return "missing meal.servings";
      // reasoning
      if (!Array.isArray(r.reasoning) || r.reasoning.length === 0) return "missing reasoning array";
      if (!r.reasoning.every((x: any) => typeof x === "string"))   return "reasoning contains non-string";
      // macros
      if (!r.macros || typeof r.macros !== "object")      return "missing macros object";
      for (const f of ["calories", "protein", "carbs", "fat"] as const) {
        if (typeof r.macros[f] !== "number")              return `missing macros.${f}`;
      }
      // shoppingList
      if (!Array.isArray(r.shoppingList) || r.shoppingList.length === 0) return "missing shoppingList array";
      for (let idx = 0; idx < r.shoppingList.length; idx++) {
        const s = r.shoppingList[idx];
        if (!s || typeof s !== "object")                  return `shoppingList[${idx}] not an object`;
        if (typeof s.item !== "string" || !s.item.trim()) return `shoppingList[${idx}] missing item`;
        if (typeof s.quantity !== "string")               return `shoppingList[${idx}] missing quantity`;
        if (typeof s.unit !== "string")                   return `shoppingList[${idx}] missing unit`;
        if (typeof s.category !== "string")               return `shoppingList[${idx}] missing category`;
      }
      // ownedIngredients (may be empty but must be a valid array)
      if (!Array.isArray(r.ownedIngredients))             return "missing ownedIngredients array";
      for (let idx = 0; idx < r.ownedIngredients.length; idx++) {
        const o = r.ownedIngredients[idx];
        if (!o || typeof o !== "object")                  return `ownedIngredients[${idx}] not an object`;
        if (typeof o.item !== "string" || !o.item.trim()) return `ownedIngredients[${idx}] missing item`;
        if (typeof o.quantity !== "string")               return `ownedIngredients[${idx}] missing quantity`;
        if (typeof o.unit !== "string")                   return `ownedIngredients[${idx}] missing unit`;
      }
      // followUpSuggestions (may be empty but must be an array)
      if (!Array.isArray(r.followUpSuggestions))          return "missing followUpSuggestions array";
      return null;
    }

    // Validate the initial response before using it.
    const initialInvalid = invalidReason(result);
    if (initialInvalid) {
      console.error(`[GroceryCoach] Initial response failed schema validation: ${initialInvalid}`);
      return res.status(500).json({ error: "Could not parse coach response. Try again." });
    }

    // ── Post-generation protocol scan ─────────────────────────────────────────
    // Grocery Coach generates a meal suggestion; run the same post-gen scan
    // that every other builder uses so GLP-1, diabetic, and allergy rules are
    // enforced on the output — not just the prompt.
    //
    // When a hard violation is detected (skipAdaptableConflicts=true means only
    // hard conflicts reach here), we retry generation with an explicit exclusion
    // appended to the system prompt — same pattern used in dessert-creator.ts.
    // If the retry also fails, we return the ORIGINAL (validated) result with
    // ndeSummary + a coach-voice warning sentence so the user is informed.
    try {
      // Combine shoppingList + ownedIngredients so the scan covers ALL
      // ingredients that will appear in the finalized meal — a forbidden or
      // allergenic ingredient the user already "owns" must still be caught.
      const buildMealForScan = (r: any) => ({
        name: r.meal?.name ?? "Grocery Coach Recommendation",
        description: r.meal?.description,
        ingredients: [
          ...(r.shoppingList ?? []).map((i: any) => ({ name: i.item ?? "" })),
          ...(r.ownedIngredients ?? []).map((i: any) => ({ name: i.item ?? "" })),
        ],
      });

      const scan = scanGeneratedOutput(buildMealForScan(result), groceryEnvelope, {
        generatorName: "grocery_coach",
        skipAdaptableConflicts: true,
      });

      if (!scan.passed) {
        // ── Hard violation detected — retry with explicit exclusion ────────────
        const violatingTerms = scan.violations.map((v: any) => v.term).filter(Boolean);
        const exclusionClause = violatingTerms.length > 0
          ? `"${violatingTerms.join('", "')}" (${scan.primaryViolation?.reason ?? "conflicts with active dietary protocol"})`
          : "the previously suggested ingredients (they conflict with the active dietary protocol)";

        const retryInstruction =
          `\n\nCRITICAL CORRECTION — RETRY REQUIRED: The previous recommendation included ${exclusionClause}. ` +
          `You MUST NOT include ${violatingTerms.length > 0 ? violatingTerms.join(", ") + " or any derivative of these ingredients" : "those ingredients"} ` +
          `in any part of the meal — not as a main ingredient, a side dish, a sauce, a garnish, or a seasoning. ` +
          `Recommend a fully compliant alternative meal that meets all of the user's active health protocols.`;

        console.warn(
          `⚠️ [GroceryCoach] Hard protocol violation — retrying. Excluded terms: ${violatingTerms.join(", ") || "(see scan message)"}`
        );

        let retryPassed = false;
        let retryScanViolations: string | undefined;

        try {
          const retryCompletion = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt + retryInstruction },
              ...priorMessages,
              { role: "user", content: message },
            ],
            response_format: { type: "json_object" },
            temperature: 0.75,
            max_tokens: 1400,
          });

          const retryRaw = retryCompletion.choices[0]?.message?.content ?? "{}";
          const retryResult = JSON.parse(retryRaw);

          // Full schema validation — a schema-invalid retry is treated as a
          // retry failure so the client always receives a complete CoachResult.
          const retryInvalid = invalidReason(retryResult);
          if (retryInvalid) {
            console.warn(`⚠️ [GroceryCoach] Retry failed schema validation (${retryInvalid}) — using original with warning.`);
          } else {
            const retryScan = scanGeneratedOutput(buildMealForScan(retryResult), groceryEnvelope, {
              generatorName: "grocery_coach_retry",
              skipAdaptableConflicts: true,
            });

            if (retryScan.passed) {
              retryPassed = true;
              console.log(`✅ [GroceryCoach] Retry passed protocol scan.`);
              return res.json({ ...retryResult, servingCount: finalServingCount });
            }
            // Capture retry scan violations for a more accurate ndeSummary.
            retryScanViolations = retryScan.violations
              .map((v: any) => v.reason || v.message || String(v))
              .filter(Boolean)
              .join("; ") || undefined;
            console.warn(`⚠️ [GroceryCoach] Retry also failed scan: ${retryScan.message}`);
          }
        } catch (retryErr: any) {
          console.warn(`⚠️ [GroceryCoach] Retry attempt threw: ${retryErr?.message}`);
        }

        // ── Both attempts failed — return the validated original with warning ──
        // `result` is always shape-valid here (validated above before this block).
        // ndeSummary prefers the retry scan's violations; falls back to the
        // original scan when the retry threw, was schema-invalid, or had no terms.
        if (!retryPassed) {
          const ndeSummary =
            retryScanViolations ??
            scan.violations.map((v: any) => v.reason || v.message || String(v)).join("; ");
          const protocolWarning =
            "I want to flag that this recommendation may not fully align with your active health protocol. " +
            "Please review the ingredients carefully with your care team before purchasing.";
          return res.json({
            ...result,
            servingCount: finalServingCount,
            ndeSummary,
            protocolWarning,
          });
        }
      }
    } catch {
      // Non-fatal — scan failure must not block the response
    }

    return res.json({ ...result, servingCount: finalServingCount });
  } catch (err: any) {
    console.error("[GroceryCoach] Error:", err?.message);
    return res.status(500).json({ error: "Your coach is unavailable right now. Please try again." });
  }
});

// ── Product Advisor — proactive brand recommendations for a meal's shopping list ──
router.post("/product-advisor", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { ingredients, store } = req.body;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: "ingredients array is required" });
    }

    const engine = getProductAdvisorEngine();
    const result = await engine.buildCartRecommendations(
      userId,
      ingredients.slice(0, 20).map(String),
      typeof store === "string" ? store : undefined,
    );

    return res.json(result);
  } catch (err: any) {
    console.error("[ProductAdvisor] Error:", err?.message);
    return res.status(500).json({ error: "Product advisor unavailable. Please try again." });
  }
});

// ── Finalize Card — generate full meal card and save to Favorites ─────────────
router.post("/finalize-card", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ status: "failed", id: null, reason: "Not authenticated" });

    const { recommendation } = req.body;
    if (!recommendation?.meal?.name) {
      return res.status(400).json({ status: "failed", id: null, reason: "recommendation is required" });
    }

    const result = await finalizeMealCard({ recommendation, userId });
    return res.json({ status: "ready", ...result });
  } catch (err: any) {
    console.error("[GroceryCoach/FinalizeCard] Error:", err?.message);
    return res.status(500).json({ status: "failed", id: null, reason: err?.message });
  }
});

export default router;
