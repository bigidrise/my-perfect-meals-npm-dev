import express from "express";
import OpenAI from "openai";
import { db } from "../db";
import { users, userSavedGroceryItems } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope, scanGeneratedOutput } from "../services/protocolEnvelope";
import { resolveGLP1GlobalContext, buildGLP1RecommendationBlock } from "../services/glp1/resolveGLP1GlobalContext";
import { getProductAdvisorEngine } from "../services/productAdvisor";
import { finalizeMealCard } from "../services/mealCardFinalizer";
import { filterSavedGroceriesForCompliance, buildSavedGroceriesPromptBlock } from "../services/savedGroceryCompliance";
import { getMealRefinementEngine } from "../services/mealRefinementEngine";
import { getLanguageInstruction } from "../utils/languageInstruction";

const router = express.Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id || (req.session as any)?.userId || req.user?.id;
}

/** Infer meal type from the user's free-text message via simple keyword detection. */
function detectMealType(message: string): "breakfast" | "lunch" | "dinner" | "snack" | null {
  const lower = message.toLowerCase();
  if (/\b(breakfast|morning meal|brunch|oatmeal|eggs?|pancakes?|waffles?|granola|smoothie bowl)\b/.test(lower)) return "breakfast";
  if (/\b(lunch|midday|noon|midday meal|lunchbox|sandwich|wrap|salad for lunch)\b/.test(lower)) return "lunch";
  if (/\b(dinner|supper|evening meal|tonight|tonight'?s? meal|what'?s? for dinner)\b/.test(lower)) return "dinner";
  if (/\b(snack|snacks?|appetizer|bite|nibble|between meals?)\b/.test(lower)) return "snack";
  return null;
}

router.post("/recommend", async (req, res) => {
  try {
    const userId = resolveUserId(req);

    const { message, conversationHistory: rawHistory, servingCount } = req.body;
    // Normalize conversationHistory: must be an array of objects with string role/content.
    // Accepts missing, null, non-array, and entries that are null or non-objects.
    const conversationHistory: Array<{ role: string; content: string }> = (() => {
      if (!Array.isArray(rawHistory)) return [];
      return rawHistory
        .filter((m): m is Record<string, unknown> => m !== null && typeof m === "object")
        .map((m) => ({
          role: typeof m.role === "string" ? m.role : "",
          content: typeof m.content === "string" ? m.content : "",
        }))
        .filter((m) => m.role !== "");
    })();

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    // Auth is enforced by requireAuth + requireProAccess at the router mount.
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const finalServingCount = Math.max(1, Math.min(12, Number(servingCount) || 1));

    const detectedMealType = detectMealType(message);
    let protocolContext = "";
    let macroContext = "";
    let groceryEnvelope = buildGuestEnvelope();
    let glp1RecommendationBlock = "";
    // Stored outside the if(userId) block so post-gen validation can access it.
    let groceryGlp1Targets: import("../services/glp1/resolveGLP1MealTargets").ResolvedGLP1Targets | null = null;
    // Saved grocery preferences — compliant items injected into the system prompt.
    let savedGroceriesBlock = "";

    if (userId) {
      // Use the same full 5-tier constraint package every other builder uses.
      groceryEnvelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
      protocolContext = enforceBeforeGenerate(groceryEnvelope, { generatorName: "grocery_coach" }).combined;

      // Load GLP-1 canonical context — fail closed
      const todayISO = new Date().toISOString().slice(0, 10);
      const glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
      if (glp1Ctx === null) {
        return res.status(503).json({ error: "Clinical guidance temporarily unavailable. Please try again.", retryable: true });
      }
      if (glp1Ctx.isActive && !glp1Ctx.resolvedTargets) {
        return res.status(503).json({ error: "GLP-1 clinical targets temporarily unavailable. Please try again.", retryable: true });
      }
      if (glp1Ctx) {
        glp1RecommendationBlock = buildGLP1RecommendationBlock(glp1Ctx);
        groceryGlp1Targets = glp1Ctx.resolvedTargets ?? null;
      }

      const [userRow] = await db
        .select({
          dailyCalorieTarget: users.dailyCalorieTarget,
          dailyProteinTarget: users.dailyProteinTarget,
          dailyFatTarget: users.dailyFatTarget,
          dailyCarbsTarget: users.dailyCarbsTarget,
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

      // ── Saved Groceries ───────────────────────────────────────────────────────
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
          let diabeticCarbCeiling: number | null = null;
          if (groceryEnvelope.hasDiabetes) {
            const dailyCarbs = userRow?.dailyCarbsTarget;
            diabeticCarbCeiling = dailyCarbs && dailyCarbs > 0 ? Math.round(dailyCarbs / 3) : 45;
          }

          const itemsWithIngredients = sgRows.map((row) => {
            const meta = (row as any).productMeta as Record<string, unknown> | null;
            const ingredients = Array.isArray(meta?.ingredients)
              ? (meta!.ingredients as string[]).filter((i) => typeof i === "string")
              : null;
            return { ...row, ingredients };
          });

          const { compliant } = filterSavedGroceriesForCompliance(
            itemsWithIngredients as any,
            groceryEnvelope,
            { glp1Targets: groceryGlp1Targets, isDiabetic: groceryEnvelope.hasDiabetes, diabeticCarbCeiling },
          );
          savedGroceriesBlock = buildSavedGroceriesPromptBlock(compliant);
          if (compliant.length > 0) {
            console.log(`[GroceryCoach] Injecting ${compliant.length} saved grocery favorites for user ${userId}`);
          }
        }
      } catch (sgErr: any) {
        console.warn("[GroceryCoach] Could not load saved groceries:", sgErr?.message);
      }
    }

    const dietaryIdentityTag = groceryEnvelope.dietaryIdentity?.length
      ? [...groceryEnvelope.dietaryIdentity].sort().join(",").toLowerCase()
      : "omnivore";

    // ── Session rejection detection ────────────────────────────────────────────
    // Inspect both conversationHistory and the current message for explicit user
    // rejection signals. When found, extract only the meal that was being rejected
    // (the assistant turn immediately before each rejection) and add those names to
    // the variety avoid-list for this request.
    const REJECTION_PATTERNS = [
      /\bno\b/i,
      /\bdifferent\b/i,
      /\bsomething else\b/i,
      /\bi don'?t want\b/i,
      /\bnot that\b/i,
      /\bdon'?t like\b/i,
      /\bchange it\b/i,
      /\bsuggest (another|a different|something else)\b/i,
      /\btry (again|another|something)\b/i,
      /\bnot (interested|into|feeling)\b/i,
      /\bpass\b/i,
      /\bskip\b/i,
    ];

    function isRejectionText(text: string): boolean {
      return REJECTION_PATTERNS.some((re) => re.test(text));
    }

    function hasRejectionSignal(history: any[], currentMsg: string): boolean {
      // Check the current message first — this is the most common rejection path.
      if (isRejectionText(currentMsg)) return true;
      // Also scan the recent user turns in history (covers multi-turn sessions).
      return history
        .filter((m: any) => m.role === "user")
        .slice(-10)
        .some((m: any) => isRejectionText(typeof m.content === "string" ? m.content : ""));
    }

    /** Parse a meal name from an assistant JSON turn; returns null on failure. */
    function parseMealNameFromAssistantTurn(turn: any): string | null {
      if (!turn || turn.role !== "assistant") return null;
      try {
        const parsed = typeof turn.content === "string" ? JSON.parse(turn.content) : turn.content;
        const name = parsed?.meal?.name;
        return typeof name === "string" && name.trim() ? name.trim() : null;
      } catch {
        return null;
      }
    }

    /**
     * For each rejection signal (current message + user turns in history),
     * extract the meal name from the assistant turn immediately before that
     * rejection. This associates only the rejected meal with the signal rather
     * than every meal in the session.
     */
    function extractRejectedMealNames(history: any[], currentMsg: string): string[] {
      const rejected: string[] = [];
      const seen = new Set<string>();

      function add(name: string | null) {
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          rejected.push(name);
        }
      }

      // If the current message is a rejection, pair it with the last assistant turn in history.
      if (isRejectionText(currentMsg)) {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].role === "assistant") {
            add(parseMealNameFromAssistantTurn(history[i]));
            break;
          }
        }
      }

      // Also scan history: each user rejection turn is paired with the assistant
      // turn immediately before it.
      for (let i = 0; i < history.length; i++) {
        const turn = history[i];
        if (
          turn.role === "user" &&
          isRejectionText(typeof turn.content === "string" ? turn.content : "")
        ) {
          for (let j = i - 1; j >= 0; j--) {
            if (history[j].role === "assistant") {
              add(parseMealNameFromAssistantTurn(history[j]));
              break;
            }
          }
        }
      }

      return rejected;
    }

    const sessionHasRejection = hasRejectionSignal(conversationHistory as any[], message);
    const sessionRejectedMealNames = sessionHasRejection
      ? extractRejectedMealNames(conversationHistory as any[], message)
      : [];

    if (sessionHasRejection && sessionRejectedMealNames.length > 0) {
      console.log(
        `[GroceryCoach] Session rejection detected — adding ${sessionRejectedMealNames.length} session meal(s) to avoid-list: ${sessionRejectedMealNames.join(", ")}`
      );
    }

    let varietyBlock = "";
    if (userId) {
      let dbHistory: Array<{ mealName: string; primaryProtein: string | null; cuisineStyle: string | null; majorStarch: string | null; cookingMethod: string | null }> = [];
      try {
        const histRows = await db.execute(
          detectedMealType
            ? sql`
                SELECT meal_name, primary_protein, cuisine_style, major_starch, cooking_method
                FROM grocery_coach_recommendation_history
                WHERE user_id = ${userId}
                  AND dietary_identity_tag = ${dietaryIdentityTag}
                  AND (meal_type = ${detectedMealType} OR meal_type IS NULL)
                ORDER BY created_at DESC
                LIMIT 20
              `
            : sql`
                SELECT meal_name, primary_protein, cuisine_style, major_starch, cooking_method
                FROM grocery_coach_recommendation_history
                WHERE user_id = ${userId}
                  AND dietary_identity_tag = ${dietaryIdentityTag}
                ORDER BY created_at DESC
                LIMIT 20
              `
        );
        dbHistory = (histRows.rows ?? histRows) as typeof dbHistory;
      } catch (histErr: any) {
        console.warn("[GroceryCoach] Could not load variety history:", histErr?.message);
      }

      // Merge DB history names with session-rejected names (deduplicated).
      const dbAvoidNames = dbHistory.map((e) => e.mealName).filter(Boolean);
      const sessionAvoidSet = new Set(sessionRejectedMealNames.map((n) => n.toLowerCase()));
      // Session-rejected meals come first so they are most prominent to the model.
      const allAvoidNames = [
        ...sessionRejectedMealNames,
        ...dbAvoidNames.filter((n) => !sessionAvoidSet.has(n.toLowerCase())),
      ];

      if (allAvoidNames.length > 0) {
        const avoidList = allAvoidNames.slice(0, 20).map((n) => `- ${n}`).join("\n");
        const recentPatterns = dbHistory.slice(0, 5).map((e) => {
          const dims = [e.primaryProtein, e.cuisineStyle, e.majorStarch, e.cookingMethod].filter(Boolean);
          return dims.length ? `- ${e.mealName} (${dims.join(", ")})` : `- ${e.mealName}`;
        }).join("\n");

        const sessionRejectionNote = sessionRejectedMealNames.length > 0
          ? `\n- The user EXPLICITLY REJECTED the following meal(s) in this session — under no circumstances suggest them again: ${sessionRejectedMealNames.map((n) => `"${n}"`).join(", ")}.`
          : "";

        varietyBlock = `

VARIETY RULES:
- NEVER recommend a meal whose name or core structure matches anything in the PREVIOUSLY RECOMMENDED list below.
- Actively rotate: protein type, cuisine/regional style, major starch, and cooking method. If recent meals all used chicken, pick a different protein. If they all used Italian style, try another cuisine.
- If the user explicitly names a food they want (e.g. "I want chicken pasta again"), honour that — explicit intent overrides variety.
- Saved Groceries preferences may still guide product choices inside the new meal; variety applies to the meal structure, not saved product brands.${sessionRejectionNote}

PREVIOUSLY RECOMMENDED — DO NOT REPEAT:
${avoidList}${recentPatterns ? `\n\nRECENT PATTERNS TO ROTATE AWAY FROM:\n${recentPatterns}` : ""}`;
      } else if (sessionRejectedMealNames.length > 0) {
        // Rejections exist but no DB history — still surface the session block.
        const sessionAvoidList = sessionRejectedMealNames.map((n) => `- ${n}`).join("\n");
        varietyBlock = `

VARIETY RULES:
- The user EXPLICITLY REJECTED the following meal(s) in this session — under no circumstances suggest them again: ${sessionRejectedMealNames.map((n) => `"${n}"`).join(", ")}.
- Actively rotate: protein type, cuisine/regional style, major starch, and cooking method.
- If the user explicitly names a food they want, honour that — explicit intent overrides variety.

PREVIOUSLY RECOMMENDED — DO NOT REPEAT:
${sessionAvoidList}`;
      }
    }
    // Note: session rejection logic only runs for authenticated users (route is
    // auth-gated; guests receive 401 before reaching this code).

    const rawLang = (req as any).authUser?.preferredLanguage || "auto";
    const langInstruction = getLanguageInstruction(rawLang);
    let systemPrompt = `You are a Grocery Store Coach — a real, confident nutrition coach who helps users decide exactly what to make for dinner and what to buy at the grocery store. You are NOT a recipe generator or meal builder. You are a decision-making assistant.

Your mission: turn "I don't know what to eat" into "Here is exactly what to buy, how much to buy, and why it fits your goals."

USER HEALTH PROFILE AND CONSTRAINTS:
${protocolContext || "No dietary restrictions or conditions on file — apply general healthy eating principles."}
${glp1RecommendationBlock ? `\n${glp1RecommendationBlock}` : ""}
${macroContext ? `\n${macroContext}` : ""}
${savedGroceriesBlock ? `\n\n${savedGroceriesBlock}` : ""}${varietyBlock}

SERVING SIZE: All ingredient quantities must be scaled for ${finalServingCount} ${finalServingCount === 1 ? "person" : "people"}.

COACHING RULES:
- MOST IMPORTANT: If the user mentions ingredients they already bought or have at home, BUILD THE MEAL AROUND THOSE INGREDIENTS. They are the anchor. Only add to the shopping list what is genuinely missing to complete the dish. Never suggest a meal that ignores or sidelines what the user says they already have. Exception: if using a stated ingredient would violate a safety, allergy, clinical, dietary, or protocol constraint, explain the conflict clearly and offer the closest safe alternative — do not silently swap it out.
- Recommend ONE specific, confident meal (may have 2-3 components, e.g., protein + starch + vegetable).
- The shopping list must be practical and grocery-store ready — include realistic quantities with units (e.g., "2 lbs", "1 bunch", "1 can"). Do NOT list ingredients the user said they already have — they already own those.
- CRITICAL — ownedIngredients vs shoppingList: ownedIngredients MUST ONLY contain ingredients the user EXPLICITLY said they already have. Explicit ownership includes both formal and informal phrasing — e.g., "I have salmon at home", "I already bought sweet potatoes", "Got some chicken", "There's salmon in my fridge", "I picked up rice earlier", "Found some broccoli at home", "I grabbed quinoa yesterday", "There's ground beef in my freezer". Any phrasing that indicates the user currently possesses or has already acquired the ingredient counts as an explicit ownership claim. Do NOT infer ownership from the meal name, meal description, or any other context. If the user asked for "salmon with collard greens" but did NOT say they have those items, salmon and collard greens belong in shoppingList — they need to buy them. Every ingredient required to cook the recommended meal that the user did not explicitly claim to already own MUST appear in shoppingList with a quantity, unit, and category.
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
  "followUpSuggestions": ["string", "string", "string"],
  "varietyMetadata": {
    "primaryProtein": "string — main protein source (e.g. 'chicken', 'tofu', 'salmon', 'beef', 'lentils')",
    "cuisineStyle": "string — cuisine or regional style (e.g. 'Italian', 'Asian', 'Mediterranean', 'American', 'Mexican')",
    "majorStarch": "string — primary starch or carb (e.g. 'pasta', 'rice', 'quinoa', 'bread', 'potato', 'none')",
    "cookingMethod": "string — dominant cooking method (e.g. 'stir-fry', 'baked', 'grilled', 'raw', 'slow-cooked', 'sautéed')"
  }
}`;
    if (langInstruction) systemPrompt = `${langInstruction}\n\n${systemPrompt}`;

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

    // ── Full schema validation ─────────────────────────────────────────────────
    const invalidReason = (r: any): string | null => {
      if (r == null || typeof r !== "object") return "response is not an object";
      if (!r.meal || typeof r.meal !== "object")          return "missing meal object";
      if (typeof r.meal.name !== "string" || !r.meal.name.trim()) return "missing meal.name";
      if (typeof r.meal.description !== "string")         return "missing meal.description";
      if (typeof r.meal.prepTime !== "string")            return "missing meal.prepTime";
      if (typeof r.meal.servings !== "number")            return "missing meal.servings";
      if (!Array.isArray(r.reasoning) || r.reasoning.length === 0) return "missing reasoning array";
      if (!r.reasoning.every((x: any) => typeof x === "string"))   return "reasoning contains non-string";
      if (!r.macros || typeof r.macros !== "object")      return "missing macros object";
      for (const f of ["calories", "protein", "carbs", "fat"] as const) {
        if (typeof r.macros[f] !== "number")              return `missing macros.${f}`;
      }
      // shoppingList may be empty when ownedIngredients covers all ingredients
      if (!Array.isArray(r.shoppingList)) return "missing shoppingList array";
      if (r.shoppingList.length === 0 && (!Array.isArray(r.ownedIngredients) || r.ownedIngredients.length === 0)) return "missing shoppingList array";
      for (let idx = 0; idx < r.shoppingList.length; idx++) {
        const s = r.shoppingList[idx];
        if (!s || typeof s !== "object")                  return `shoppingList[${idx}] not an object`;
        if (typeof s.item !== "string" || !s.item.trim()) return `shoppingList[${idx}] missing item`;
        if (typeof s.quantity !== "string")               return `shoppingList[${idx}] missing quantity`;
        if (typeof s.unit !== "string")                   return `shoppingList[${idx}] missing unit`;
        if (typeof s.category !== "string")               return `shoppingList[${idx}] missing category`;
      }
      if (!Array.isArray(r.ownedIngredients))             return "missing ownedIngredients array";
      for (let idx = 0; idx < r.ownedIngredients.length; idx++) {
        const o = r.ownedIngredients[idx];
        if (!o || typeof o !== "object")                  return `ownedIngredients[${idx}] not an object`;
        if (typeof o.item !== "string" || !o.item.trim()) return `ownedIngredients[${idx}] missing item`;
        if (typeof o.quantity !== "string")               return `ownedIngredients[${idx}] missing quantity`;
        if (typeof o.unit !== "string")                   return `ownedIngredients[${idx}] missing unit`;
      }
      if (!Array.isArray(r.followUpSuggestions))          return "missing followUpSuggestions array";
      return null;
    };

    const initialInvalid = invalidReason(result);
    if (initialInvalid) {
      console.error(`[GroceryCoach] Initial response failed schema validation: ${initialInvalid}`);
      return res.status(500).json({ error: "Could not parse coach response. Try again." });
    }

    // ── GLP-1 post-gen macro validation ──────────────────────────────────────
    if (groceryGlp1Targets) {
      const t = groceryGlp1Targets;
      const mac = result.macros ?? {};
      const fat      = Number(mac.fat);
      const cal = Number(mac.calories);
      const prot = Number(mac.protein);
      const fatViolation = Number.isFinite(fat) && fat > t.maximumToleratedFatGrams;
      const calViolation = Number.isFinite(cal) && cal > t.resolvedMealCalories * 1.25;
      const protFloorViolation = Number.isFinite(prot) && prot < t.minimumProteinFloor * 0.75;
      if (fatViolation || calViolation) {
        console.warn(`[GroceryCoach/GLP-1] Macro violation — fat:${fat}g cal:${cal} — retrying`);
        const glp1MacroFix =
          `\n\nCRITICAL GLP-1 MACRO CORRECTION: Your previous recommendation had ` +
          `${fat}g fat (limit is ${t.maximumToleratedFatGrams}g) and ${Math.round(cal)} calories ` +
          `(limit is ~${t.resolvedMealCalories} kcal). Recommend a lower-fat alternative meal ` +
          `using lean proteins and non-oily cooking methods. ` +
          `Fat must be ≤ ${t.maximumToleratedFatGrams}g and calories ≤ ${t.resolvedMealCalories} kcal.`;
        try {
          const glp1RetryCompletion = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt + glp1MacroFix },
              ...priorMessages,
              { role: "user", content: message },
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
            max_tokens: 1400,
          });
          const glp1RetryRaw = glp1RetryCompletion.choices[0]?.message?.content ?? "{}";
          const glp1RetryResult = JSON.parse(glp1RetryRaw);
          const glp1RetryInvalid = invalidReason(glp1RetryResult);
          if (!glp1RetryInvalid) {
            const retryFat = Number(glp1RetryResult.macros?.fat);
            const retryCal = Number(glp1RetryResult.macros?.calories);
            if (
              (!Number.isFinite(retryFat) || retryFat <= t.maximumToleratedFatGrams) &&
              (!Number.isFinite(retryCal) || retryCal <= t.resolvedMealCalories * 1.25)
            ) {
              console.log(`✅ [GroceryCoach/GLP-1] Retry passed — fat:${retryFat}g cal:${retryCal}`);
              Object.assign(result, glp1RetryResult);
            } else {
              console.warn(`[GroceryCoach/GLP-1] Retry still non-compliant — returning 400`);
              return res.status(400).json({
                error: "PROTOCOL_VIOLATION",
                message: `Could not find a meal within your GLP-1 fat limit (${t.maximumToleratedFatGrams}g). Try asking for a lighter option.`,
                retryable: true,
              });
            }
          } else {
            console.warn(`[GroceryCoach/GLP-1] Retry failed schema — using original with warning`);
          }
        } catch (glp1RetryErr) {
          console.warn("[GroceryCoach/GLP-1] Retry request failed:", glp1RetryErr);
        }
      }
      if (protFloorViolation) {
        console.warn(`[GroceryCoach/GLP-1] Protein ${prot}g below floor ${t.minimumProteinFloor}g — appending note`);
        if (Array.isArray(result.reasoning)) {
          result.reasoning.push(`GLP-1 note: This meal's protein (${Math.round(prot)}g) is below your target of ${t.minimumProteinFloor}g. Consider adding a lean protein source such as egg whites, white fish, or legumes.`);
        }
      }
    }

    // ── Save to recommendation history (non-blocking, fire-and-forget) ────────
    // Wrapped in Promise.resolve().then() so any synchronous failure (e.g. db
    // not yet initialised in tests) is caught by .catch() and never propagates
    // to the outer request handler.
    // Defined before the scan block so both the retry-success path and the
    // main-success path can call it.
    const saveToHistory = (uid: string, meal: any) => {
      if (!uid || !meal?.name) return;
      const vm = meal.varietyMetadata as Record<string, string> | undefined;
      Promise.resolve().then(() =>
        db.execute(sql`
          INSERT INTO grocery_coach_recommendation_history
            (user_id, meal_name, primary_protein, cuisine_style, major_starch, cooking_method, dietary_identity_tag, meal_type)
          VALUES
            (${uid}, ${meal.name as string},
             ${vm?.primaryProtein ?? null}, ${vm?.cuisineStyle ?? null},
             ${vm?.majorStarch ?? null}, ${vm?.cookingMethod ?? null},
             ${dietaryIdentityTag}, ${detectedMealType ?? null})
        `)
      ).then(() =>
        // Prune to 20 rows scoped by (user_id, dietary_identity_tag) so history
        // for one diet identity never evicts history from another identity.
        db.execute(sql`
          DELETE FROM grocery_coach_recommendation_history
          WHERE user_id = ${uid}
            AND dietary_identity_tag = ${dietaryIdentityTag}
            AND id NOT IN (
              SELECT id FROM grocery_coach_recommendation_history
              WHERE user_id = ${uid}
                AND dietary_identity_tag = ${dietaryIdentityTag}
              ORDER BY created_at DESC
              LIMIT 20
            )
        `)
      ).catch((e: any) => console.warn("[GroceryCoach] History save failed:", e?.message));
    };

    // ── Post-generation protocol scan ─────────────────────────────────────────
    try {
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
        const violatingTerms = scan.violations.map((v: any) => v.term).filter(Boolean);
        const exclusionClause = violatingTerms.length > 0
          ? `"${violatingTerms.join('", "')}" (${scan.primaryViolation?.reason ?? "conflicts with active dietary protocol"})`
          : "the previously suggested ingredients (they conflict with the active dietary protocol)";

        const retryInstruction =
          `\n\nCRITICAL CORRECTION — RETRY REQUIRED: The previous recommendation included ${exclusionClause}. ` +
          `You MUST NOT include ${violatingTerms.length > 0 ? violatingTerms.join(", ") + " or any derivative of these ingredients" : "those ingredients"} ` +
          `in any part of the meal — not as a main ingredient, a side dish, a sauce, a garnish, or a seasoning. ` +
          `Recommend a fully compliant alternative meal that meets all of the user's active health protocols.`;

        console.warn(`⚠️ [GroceryCoach] Hard protocol violation — retrying. Excluded terms: ${violatingTerms.join(", ") || "(see scan message)"}`);

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
              if (userId) saveToHistory(userId, retryResult?.meal ? { ...retryResult.meal, varietyMetadata: retryResult.varietyMetadata } : null);
              return res.json({ ...retryResult, servingCount: finalServingCount });
            }
            retryScanViolations = retryScan.violations
              .map((v: any) => v.reason || v.message || String(v))
              .filter(Boolean)
              .join("; ") || undefined;
            console.warn(`⚠️ [GroceryCoach] Retry also failed scan: ${retryScan.message}`);
          }
        } catch (retryErr: any) {
          console.warn(`⚠️ [GroceryCoach] Retry attempt threw: ${retryErr?.message}`);
        }

        if (!retryPassed) {
          const ndeSummary =
            retryScanViolations ??
            scan.violations.map((v: any) => v.reason || v.message || String(v)).join("; ");
          console.error(`🚫 [GroceryCoach] Both generation attempts failed hard protocol scan — blocking response. violations: ${ndeSummary}`);
          return res.status(422).json({
            error: "This recommendation conflicts with your active health protocol and cannot be shown safely. Please try a different item.",
            ndeSummary,
          });
        }
      }
    } catch (scanErr: any) {
      throw scanErr;
    }

    if (userId) saveToHistory(userId, result?.meal ? { ...result.meal, varietyMetadata: result.varietyMetadata } : null);

    return res.json({ ...result, servingCount: finalServingCount });
  } catch (err: any) {
    console.error("[GroceryCoach] Error:", err?.message);
    return res.status(500).json({ error: "Your coach is unavailable right now. Please try again." });
  }
});

// ── Product Advisor ─────────────────────────────────────────────────────────────
router.post("/product-advisor", async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { ingredients, store } = req.body;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: "ingredients array is required" });
    }

    const engine = getProductAdvisorEngine();
    const result = await engine.buildCartRecommendations(userId!, ingredients as string[], store);

    return res.json(result);
  } catch (err: any) {
    console.error("[ProductAdvisor] Error:", err?.message);
    return res.status(500).json({ error: "Product advisor unavailable. Please try again." });
  }
});

// ── Ingredient Swap ─────────────────────────────────────────────────────────────
// Replace ONE ingredient in an existing Grocery Coach recommendation.
// Delegates to the shared MealRefinementEngine (refineMeal) so all protocol
// enforcement (envelope, GLP-1 fail-closed, NDE scan, diabetic starch gate,
// saved groceries) lives in one place. Alternatives generated separately and
// NDE-scanned before return. Coach suggests; user confirms — never silently changes.
router.post("/swap-ingredient", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const {
      ingredientToReplace, mealName, mealDescription,
      shoppingList, ownedIngredients, macros, reasoning,
      remainingIngredients, userRequest,
    } = req.body;

    if (!ingredientToReplace || typeof ingredientToReplace !== "string") {
      return res.status(400).json({ error: "ingredientToReplace is required" });
    }

    // Build an existingMeal object from whatever the client sent.
    const existingMeal: Record<string, unknown> = {
      meal: {
        name: mealName || "current meal",
        description: mealDescription || "",
      },
      shoppingList: Array.isArray(shoppingList)
        ? shoppingList
        : (Array.isArray(remainingIngredients)
            ? remainingIngredients.map((item: string) => ({ item, quantity: "", unit: "" }))
            : [{ item: ingredientToReplace, quantity: "", unit: "" }]),
      ownedIngredients: Array.isArray(ownedIngredients) ? ownedIngredients : [],
      macros: macros && typeof macros === "object" ? macros : {},
      reasoning: Array.isArray(reasoning) ? reasoning : [],
    };

    const changeInstruction = userRequest
      ? `Replace "${ingredientToReplace}" with "${userRequest}" if it is clinically safe and fits the meal style; otherwise replace it with the single best compliant alternative.`
      : `Replace "${ingredientToReplace}" with the single best compliant alternative that fits the meal style and the user's protocol.`;

    const { refineMeal, MealRefinementRetryableError } = await import("../services/mealRefinementEngine");

    // ── Primary swap via engine (protocol-enforced) ───────────────────────
    const refined = await refineMeal({
      userId,
      existingMeal,
      changeInstruction,
      generatorName: "grocery_swap",
      preferredLanguage: (req as any).authUser?.preferredLanguage,
    });

    // ── Extract coachSuggestion from the updated shoppingList ─────────────
    const oldItemsSet = new Set<string>(
      (existingMeal.shoppingList as any[]).map((i: any) =>
        typeof i.item === "string" ? i.item.toLowerCase().trim() : "",
      ),
    );
    const newList = Array.isArray((refined.updatedMeal as any).shoppingList)
      ? (refined.updatedMeal as any).shoppingList
      : [];

    const newEntry =
      newList.find(
        (i: any) => typeof i.item === "string" && !oldItemsSet.has(i.item.toLowerCase().trim()),
      ) ?? newList[0];

    const suggestionItem: string = newEntry?.item ?? ingredientToReplace;
    const suggestionQty: string  = newEntry?.quantity ?? "";
    const suggestionUnit: string = newEntry?.unit ?? "";

    // ── Alternatives — lightweight follow-up LLM call ─────────────────────
    let alternatives: Array<{ item: string; reason: string }> = [];
    let savedOption: { item: string; reason: string } | null = null;

    try {
      const swapEnvelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
      const altProtocolCtx = enforceBeforeGenerate(swapEnvelope, { generatorName: "grocery_swap_alt" }).combined;

      // Load GLP-1 targets for alternatives enforcement.
      // The primary suggestion went through the full engine (fail-closed); for
      // alternatives we load targets explicitly so the same fat/calorie ceiling
      // applies to every option returned to the user.
      const todayISO = new Date().toISOString().slice(0, 10);
      const altGlp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
      const altGlp1Targets = (altGlp1Ctx?.isActive && altGlp1Ctx.resolvedTargets)
        ? altGlp1Ctx.resolvedTargets
        : null;

      // Explicit clinical constraint blocks injected into the alternatives prompt.
      const glp1AltBlock = altGlp1Targets
        ? `GLP-1 CONSTRAINT: Every alternative MUST have ≤${altGlp1Targets.maximumToleratedFatGrams}g fat per serving and ≤${altGlp1Targets.resolvedMealCalories} kcal. Do NOT suggest fatty meats, oils, full-fat dairy, fried preparations, or avocado.\n\n`
        : "";
      const diabeticAltBlock = swapEnvelope.hasDiabetes
        ? `DIABETIC CONSTRAINT: Every alternative MUST be low-carb. Do NOT suggest bread, rice, pasta, potatoes, corn, or sugary sauces. Prefer non-starchy vegetables, lean proteins, or legumes.\n\n`
        : "";

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

      const savedProductNames = sgRows.map((r) => r.productName).filter(Boolean);

      const altCompletion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              `You are a Grocery Coach. The user's primary swap for "${ingredientToReplace}" is "${suggestionItem}". ` +
              `Suggest 2 DIFFERENT alternative replacements (not "${suggestionItem}", not "${ingredientToReplace}") ` +
              `that fit the meal "${mealName || "current meal"}".\n\n` +
              `${glp1AltBlock}${diabeticAltBlock}` +
              `Also comply with:\n${altProtocolCtx || "No restrictions."}\n\n` +
              (savedProductNames.length > 0
                ? `User's saved products (prefer as savedOption if one complies with ALL constraints above): ${savedProductNames.join(", ")}\n\n`
                : "") +
              `Respond ONLY with valid JSON:\n` +
              `{ "alternatives": [{ "item": "string", "reason": "string — 1 sentence" }], ` +
              `"savedOption": { "item": "string", "reason": "string — mention it's from their saved products" } | null }`,
          },
          { role: "user", content: `Give 2 alternatives to replace "${ingredientToReplace}" in this meal.` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 400,
      });

      const altRaw = altCompletion.choices[0]?.message?.content ?? "{}";
      let altData: any;
      try {
        altData = JSON.parse(altRaw);
      } catch {
        altData = {};
      }

      // Whether this user has a clinical protocol requiring verified macros.
      const isClinical = altGlp1Targets !== null || swapEnvelope.hasDiabetes;

      // ── Alternatives: NDE scan only (no nutrition data available from LLM)
      // For clinical users we cannot verify that the LLM-suggested item meets
      // fat/carb ceilings, so alternatives are omitted — the primary suggestion
      // from the engine is already macro-verified and is sufficient.
      if (!isClinical && Array.isArray(altData.alternatives)) {
        for (const alt of altData.alternatives.slice(0, 2)) {
          if (!alt?.item || typeof alt.item !== "string") continue;
          const altScan = scanGeneratedOutput(
            { name: `Alt: ${alt.item}`, ingredients: [{ name: alt.item }] },
            swapEnvelope,
            { generatorName: "grocery_swap_alt", skipAdaptableConflicts: true },
          );
          if (altScan.passed) {
            alternatives.push({ item: alt.item, reason: alt.reason ?? "" });
          }
        }
      }

      if (altData.savedOption?.item && typeof altData.savedOption.item === "string") {
        const soScan = scanGeneratedOutput(
          { name: `SavedOpt: ${altData.savedOption.item}`, ingredients: [{ name: altData.savedOption.item }] },
          swapEnvelope,
          { generatorName: "grocery_swap_saved", skipAdaptableConflicts: true },
        );

        if (soScan.passed) {
          // ── savedOption macro gate ────────────────────────────────────────
          // For clinical users, validate fat/carbs from nutritionJson.
          // If the saved row has no nutritionJson, the macros are unverifiable
          // → reject for clinical users rather than surface an unsafe option.
          const matchedRow = sgRows.find(
            (r) => r.productName?.toLowerCase().trim() === altData.savedOption.item.toLowerCase().trim(),
          );

          let savedOptionOk = true;

          if (isClinical) {
            if (!matchedRow?.nutritionJson) {
              // Cannot verify clinical compliance without nutrition data — fail closed.
              console.warn(
                `[GroceryCoach/Swap] savedOption "${altData.savedOption.item}" has no nutritionJson — rejected for clinical user`,
              );
              savedOptionOk = false;
            } else {
              const nut = matchedRow.nutritionJson as Record<string, unknown>;
              const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
              const fat      = toN(nut.fat ?? nut.total_fat ?? nut.fatGrams);
              const calories = toN(nut.calories ?? nut.energy ?? nut.kcal);
              const carbs    = toN(nut.carbs ?? nut.total_carbohydrates ?? nut.carbGrams);

              if (altGlp1Targets) {
                // Fat must be present AND within ceiling — null fat = unverifiable = reject.
                if (fat === null) {
                  console.warn(`[GroceryCoach/Swap] savedOption "${altData.savedOption.item}" has no fat value — rejected for GLP-1 user`);
                  savedOptionOk = false;
                } else if (fat > altGlp1Targets.maximumToleratedFatGrams) {
                  console.warn(`[GroceryCoach/Swap] savedOption "${altData.savedOption.item}" fat=${fat}g > GLP-1 ceiling ${altGlp1Targets.maximumToleratedFatGrams}g — rejected`);
                  savedOptionOk = false;
                }
                // Calories — reject if present and over ceiling; unverifiable calories are
                // still allowed (fat ceiling is the primary GLP-1 gate for swaps).
                if (savedOptionOk && calories !== null && calories > altGlp1Targets.resolvedMealCalories) {
                  console.warn(`[GroceryCoach/Swap] savedOption "${altData.savedOption.item}" calories=${calories} > GLP-1 ceiling ${altGlp1Targets.resolvedMealCalories} — rejected`);
                  savedOptionOk = false;
                }
              }

              if (savedOptionOk && swapEnvelope.hasDiabetes) {
                // Carbs must be present AND within ceiling for diabetic users.
                if (carbs === null) {
                  console.warn(`[GroceryCoach/Swap] savedOption "${altData.savedOption.item}" has no carbs value — rejected for diabetic user`);
                  savedOptionOk = false;
                } else if (carbs > 45) {
                  console.warn(`[GroceryCoach/Swap] savedOption "${altData.savedOption.item}" carbs=${carbs}g > diabetic ceiling 45g — rejected`);
                  savedOptionOk = false;
                }
              }
            }
          }

          if (savedOptionOk) {
            savedOption = { item: altData.savedOption.item, reason: altData.savedOption.reason ?? "" };
          }
        }
      }
    } catch (altErr: any) {
      console.warn("[GroceryCoach/Swap] Alternatives generation failed:", altErr?.message);
    }

    return res.json({
      coachSuggestion: {
        item: suggestionItem,
        reason: refined.changesSummary,
        quantity: suggestionQty,
        unit: suggestionUnit,
      },
      savedOption,
      alternatives,
      protocolNote: refined.protocolNote ?? null,
      updatedMeal: refined.updatedMeal,
    });
  } catch (err: any) {
    const message: string = err?.message ?? "Ingredient swap unavailable. Please try again.";

    if (err?.name === "MealRefinementRetryableError") {
      return res.status(503).json({ error: message, retryable: true });
    }
    if (message.startsWith("PROTOCOL_VIOLATION")) {
      return res.status(400).json({
        error: "PROTOCOL_VIOLATION",
        message: message.replace(/^PROTOCOL_VIOLATION:\s*/, ""),
        retryable: true,
      });
    }
    if (message.includes("conflicts with your active health protocol")) {
      return res.status(422).json({ error: message });
    }

    console.error("[GroceryCoach/Swap] Error:", message);
    return res.status(500).json({ error: "Ingredient swap unavailable. Please try again." });
  }
});

// ── Finalize Card ──────────────────────────────────────────────────────────────
router.post("/finalize-card", async (req, res) => {
  try {
    const userId = resolveUserId(req);

    const { recommendation } = req.body;
    if (!recommendation?.meal?.name) {
      return res.status(400).json({ status: "failed", id: null, reason: "recommendation is required" });
    }

    const result = await finalizeMealCard({ recommendation, userId: userId! });
    return res.json({ status: "ready", ...result });
  } catch (err: any) {
    console.error("[GroceryCoach/FinalizeCard] Error:", err?.message);
    return res.status(500).json({ status: "failed", id: null, reason: err?.message });
  }
});

export default router;
