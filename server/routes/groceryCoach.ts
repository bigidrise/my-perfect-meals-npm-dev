import express from "express";
import OpenAI from "openai";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope } from "../services/protocolEnvelope";
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

    if (userId) {
      // Use the same full 5-tier constraint package every other builder uses.
      // This covers: dietary identity, allergies (hard-stop), medical hard limits,
      // condition guidance blocks (GLP-1, oncology, pregnancy, thyroid, etc.),
      // palate preferences, sweetener rules, procedural/cross-contamination rules,
      // and performance nutrition overlay.
      const envelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
      protocolContext = enforceBeforeGenerate(envelope, { generatorName: "grocery_coach" }).combined;

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
