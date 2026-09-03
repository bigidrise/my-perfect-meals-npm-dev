// --- server/routes/dessert-creator.ts ---
// Dessert Creator Route - RESTRUCTURED (December 9, 2025)
// New 5-field structure: Category, Flavor Family, Specific Dessert, Serving Size, Dietary

import { Router } from "express";
import { getMeasurementPromptBlock, MeasurementSystem } from "../../shared/units";
import OpenAI from "openai";
import { computeMedicalBadges, computeAlphaGalBadge } from "../services/medicalBadges";
import { normalizeIngredients } from "../services/ingredientNormalizer";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { buildPalateSection, PalatePreferences, buildStrictModeBlock, buildSweetenerAllowlistBlock, resolveSweetenerAllowlist } from "../services/promptBuilder";
import { loadUserProtocolEnvelope, enforceBeforeGenerate, scanGeneratedOutput, buildGuestEnvelope, buildMealComplianceBundle } from "../services/protocolEnvelope";
import { derivePreferenceProfile, buildBehavioralMemoryPromptSection } from "../services/behavioralMemoryService";
import { getPrimaryDiet } from "../services/allergyGuardrails";
import { buildChefAdaptationBlock } from "../utils/chefAdaptationBlock";
import { resolveCreatorSystemForUser } from "../services/creatorSystems/resolveCreatorSystemForUser";
import { applyCreatorTransformation } from "../services/creatorSystems/applyCreatorTransformation";
import { emitActivityEvent } from "../services/coaching/activityEvents";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { getDishAdaptationDirective, buildGuardrailContext } from "../services/dishAdaptation/dishAdaptationLayer";
import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";
import { getAuthUserId } from "../utils/getAuthUserId";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const dessertCreatorRouter = Router();

const SERVING_MULTIPLIERS: Record<string, { count: number; label: string; tiers?: number }> = {
  single: { count: 1, label: "1 serving" },
  two: { count: 2, label: "2 servings" },
  family: { count: 6, label: "6 servings (family-style)" },
  batch: { count: 12, label: "12 servings (batch)" },
  "small-wedding": { count: 40, label: "Small Wedding (30–50 guests)", tiers: 2 },
  "medium-wedding": { count: 88, label: "Medium Wedding (75–100 guests)", tiers: 3 },
  "large-wedding": { count: 135, label: "Large Wedding (120–150 guests)", tiers: 3 },
  "extra-large-wedding": { count: 200, label: "Large Event (200+ guests)", tiers: 4 },
};

const CATEGORY_LABELS: Record<string, string> = {
  pie: "Pie",
  cake: "Cake",
  cookies: "Cookies",
  brownies: "Brownies",
  cheesecake: "Cheesecake",
  smoothie: "Smoothie",
  frozen: "Frozen Dessert",
  pudding: "Pudding / Custard",
  nobake: "No-Bake Dessert",
  bars: "Bars",
  muffins: "Muffins",
  cupcakes: "Cupcakes",
};

const FLAVOR_LABELS: Record<string, string> = {
  apple: "Apple",
  strawberry: "Strawberry",
  blueberry: "Blueberry",
  "lemon-lime": "Lemon / Lime",
  peach: "Peach",
  cherry: "Cherry",
  mango: "Mango",
  chocolate: "Chocolate",
  vanilla: "Vanilla",
  "peanut-butter": "Peanut Butter",
  "cinnamon-spice": "Cinnamon / Spice",
  coffee: "Coffee",
  caramel: "Caramel",
};

const CAKE_STYLE_LABELS: Record<string, string> = {
  classic: "Classic Frosted",
  "semi-naked": "Semi-Naked (Light Frosting)",
  naked: "Naked Cake (Minimal Frosting)",
};

const CAKE_TYPE_LABELS: Record<string, string> = {
  "wedding-cake": "Wedding Cake",
  "birthday-cake": "Birthday Cake",
  "celebration-cake": "Celebration Cake",
};

const isDev = process.env.NODE_ENV === "development";

dessertCreatorRouter.post("/", async (req, res) => {
  if (isDev) console.log("[DESSERT] POST request received");
  try {
    const userId = getAuthUserId(req);
    const {
      dessertCategory,
      flavorFamily,
      specificDessert,
      servingSize,
      cakeStyle,
      cakeType,
      dietaryPreferences,
      dietOverride,           // builder hub diet override — replaces profile primary diet
      safetyMode,
      overrideToken,
      skipPalate,
      strictMode,
      customDessertDescription,
      dietAdaptOverride,
      userDietOverride,
    } = req.body ?? {};

    const hasCustomDescription = !!(customDessertDescription && typeof customDessertDescription === 'string' && customDessertDescription.trim().length > 0);

    if (!hasCustomDescription && !dessertCategory) {
      return res.status(400).json({ error: "Dessert category is required" });
    }

    if (!hasCustomDescription && !flavorFamily) {
      return res.status(400).json({ error: "Flavor family is required" });
    }

    const { resolveHumanFoodContext, issueHumanFoodContextMeta } = await import("../services/humanFoodContext/resolveHumanFoodContext");
    const { buildCreatorHumanFoodPrompt, validateCreatorHumanFoodResult } = await import("../services/humanFoodContext/adapters");
    const humanFoodContext = await resolveHumanFoodContext({
      actorUserId: userId,
      subjectUserId: userId,
      creator: "dessert_creator",
      correlationId: (req as any).id,
      receipt: typeof req.body.humanFoodContextReceipt === "string" ? req.body.humanFoodContextReceipt : null,
      generationChainId: typeof req.body.humanFoodGenerationChainId === "string" ? req.body.humanFoodGenerationChainId : null,
      dietOverride: typeof dietOverride === "string" ? dietOverride : null,
      cuisine: typeof req.body.cultureOverride === "string" ? req.body.cultureOverride : null,
      cuisineIntensity: typeof req.body.cuisineIntensity === "string" ? req.body.cuisineIntensity : null,
    });
    if (humanFoodContext.status === "review_required" || humanFoodContext.status === "blocked") {
      return res.status(409).json({
        code: "HUMAN_FOOD_CONTEXT_UNRESOLVED",
        status: humanFoodContext.status,
        message: humanFoodContext.notices[0] || "Required food context could not be resolved safely.",
      });
    }
    const humanFoodPrompt = buildCreatorHumanFoodPrompt("dessert_creator", humanFoodContext);

    // 🚨 SAFETY INTELLIGENCE LAYER: Pre-generation enforcement
    let dietAdapted = false;
    let dietNotice = "";
    // Allergen-specific override for this request only. All other allergies remain enforced.
    let _overriddenDessertAllergens: string[] = [];
    if (userId) {
      const inputText = [specificDessert, flavorFamily, dessertCategory].filter(Boolean).join(' ');
      const safetyCheck = await enforceSafetyProfile(userId, inputText, "dessert-creator", {
        safetyMode: safetyMode || "STRICT",
        overrideToken: overrideToken,
        correlationId: (req as any).id
      });
      if (safetyCheck.result === "BLOCKED") {
        console.log(`[DESSERT] Request blocked by safety policy; requestId=${(req as any).id ?? "unavailable"}`);
        return res.status(400).json({
          success: false,
          error: safetyCheck.message,
          safetyBlocked: true,
          blockedTerms: safetyCheck.blockedTerms,
          suggestion: safetyCheck.suggestion
        });
      }
      if (safetyCheck.result === "AMBIGUOUS") {
        return res.status(400).json({
          success: false,
          error: safetyCheck.message,
          safetyAmbiguous: true,
          ambiguousTerms: safetyCheck.ambiguousTerms,
          suggestion: safetyCheck.suggestion
        });
      }
      if (safetyCheck.result === "DIET_ADAPT") {
        dietAdapted = true;
        dietNotice = safetyCheck.message;
      }
      if (safetyCheck.overriddenAllergen) {
        _overriddenDessertAllergens = [safetyCheck.overriddenAllergen];
        console.log(`[DESSERT] Request-scoped safety override applied; requestId=${(req as any).id ?? "unavailable"}`);
      }
    }

    // ── Load protocol envelope (drives all dietary enforcement) ───────────────
    const dessertEnvelope = (userId && userId !== "1")
      ? (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope()
      : buildGuestEnvelope();

    // Apply per-request culture override if provided (overrides saved cuisine profile for this generation only)
    const cultureOverride = req.body?.cultureOverride?.trim() || null;
    if (cultureOverride) {
      dessertEnvelope.cuisinePreference = cultureOverride;
      dessertEnvelope.cuisineIntensity = "balanced";
    }

    const dessertProtocolBlock = enforceBeforeGenerate(dessertEnvelope, {
      generatorName: 'dessert_creator',
    }).combined;

    // 🎨 PALATE PREFERENCES: Load flavor preferences for seasoning/flavor guidance
    let palateGuidance = "\nFLAVOR STYLE: Use light, neutral flavoring suitable for serving to guests or family.";
    let sweetenerGuidance = "";
    let userDietaryRestrictions: string[] = [];
    let dessertMeasurementSystem: MeasurementSystem = "imperial";
    if (userId && userId !== "1") {
      try {
        const [user] = await db.select({
          palateSpiceTolerance: users.palateSpiceTolerance,
          palateSeasoningIntensity: users.palateSeasoningIntensity,
          palateFlavorStyle: users.palateFlavorStyle,
          flavorPreference: users.flavorPreference,
          heatPreference: users.heatPreference,
          medicalConditions: users.medicalConditions,
          dietaryRestrictions: users.dietaryRestrictions,
          measurementSystem: users.measurementSystem,
          preferredSweeteners: users.preferredSweeteners,
          avoidSweeteners: users.avoidSweeteners,
          sweetenerPreferences: users.sweetenerPreferences,
        }).from(users).where(eq(users.id, userId)).limit(1);
        
        if (user) {
          userDietaryRestrictions = (user.dietaryRestrictions as string[]) || [];
          dessertMeasurementSystem = (user.measurementSystem as MeasurementSystem) ?? "imperial";
          if (!skipPalate && (user.flavorPreference || user.heatPreference || user.palateSpiceTolerance || user.palateSeasoningIntensity || user.palateFlavorStyle)) {
            const palatePrefs: PalatePreferences = {
              palateSpiceTolerance: user.palateSpiceTolerance as PalatePreferences['palateSpiceTolerance'],
              palateSeasoningIntensity: user.palateSeasoningIntensity as PalatePreferences['palateSeasoningIntensity'],
              palateFlavorStyle: user.palateFlavorStyle as PalatePreferences['palateFlavorStyle'],
              flavorPreference: user.flavorPreference,
              heatPreference: user.heatPreference,
              medicalConditions: (user.medicalConditions as string[]) || [],
            };
            palateGuidance = `\nFLAVOR PREFERENCES: ${buildPalateSection(palatePrefs)}`;
            console.log(`[DESSERT] Palate preferences loaded; requestId=${(req as any).id ?? "unavailable"}`);
          }
          // Sweetener allowlist — always enforced regardless of skipPalate
          // resolveSweetenerAllowlist falls back to sweetenerPreferences column
          // for users who haven't re-saved since the bridge was deployed
          const { preferred, avoidAll } = resolveSweetenerAllowlist(
            (user.preferredSweeteners as string[]) || [],
            (user.avoidSweeteners as string[]) || [],
            (user.sweetenerPreferences as string[]) || []
          );
          const block = buildSweetenerAllowlistBlock(preferred, avoidAll);
          if (block) {
            sweetenerGuidance = `\n${block}`;
            console.log(`[DESSERT] Sweetener policy loaded; requestId=${(req as any).id ?? "unavailable"}`);
          }
        }
      } catch (err) {
        console.warn(`[DESSERT] PROFILE_LOAD_FAILED; requestId=${(req as any).id ?? "unavailable"}`);
      }
    } else if (skipPalate) {
      console.log(`[DESSERT] Neutral flavor policy applied; requestId=${(req as any).id ?? "unavailable"}`);
    }

    const serving = SERVING_MULTIPLIERS[servingSize] || SERVING_MULTIPLIERS.single;
    const categoryLabel = CATEGORY_LABELS[dessertCategory] || dessertCategory;
    const flavorLabel = FLAVOR_LABELS[flavorFamily] || flavorFamily;
    const cakeStyleLabel = cakeStyle ? CAKE_STYLE_LABELS[cakeStyle] || cakeStyle : null;
    const cakeTypeLabel = cakeType ? CAKE_TYPE_LABELS[cakeType] || cakeType : null;
    // ── Builder diet override — REPLACES profile primary diet for this generation ──
    // Precedence: explicit dietOverride > dietaryPreferences (form picker) > profile diet.
    // Hard restrictions (allergies, medical, specialty, religious) remain enforced
    // through the protocol envelope regardless of this override.
    const { resolveEffectiveDiet } = await import("../services/resolveEffectiveDiet");
    const _effectiveDiet = resolveEffectiveDiet(dietOverride, userDietaryRestrictions);
    const dietaryRules = _effectiveDiet.length > 0
      ? _effectiveDiet.map((d: string) => d.replace(/-/g, " ")).join(", ")
      : Array.isArray(dietaryPreferences) && dietaryPreferences.length > 0
        ? dietaryPreferences.map((d: string) => d.replace(/-/g, " ")).join(", ")
        : "none specified";
    if (dietOverride) {
      console.log(`[DESSERT] Diet override applied; requestId=${(req as any).id ?? "unavailable"}`);
    }

    const isWeddingCake = cakeType === "wedding-cake";
    const isNakedCake = cakeStyle === "naked" || cakeStyle === "semi-naked";
    const isCelebrationCake = isWeddingCake || cakeType === "celebration-cake" || cakeType === "birthday-cake";

    const cakeRulesBlock = dessertCategory === "cake" ? `
🎂 CAKE-SPECIFIC RULES:
- Cake Style: ${cakeStyleLabel || "Classic Frosted"}
- Cake Type: ${cakeTypeLabel || "Standard cake"}
${isNakedCake ? `
NAKED/SEMI-NAKED CAKE REQUIREMENTS:
- Reduce frosting volume significantly (naked = minimal, semi-naked = thin layer showing cake layers)
- Favor lighter fillings: fresh fruit, mascarpone, whipped yogurt-cream, lemon curd, fresh berries
- Emphasize the cake layers themselves - they should be the star
- Use drip glazes or fresh fruit decoration instead of heavy buttercream
- The aesthetic is rustic, elegant, and naturally beautiful
` : ""}
${isWeddingCake ? `
WEDDING CAKE REQUIREMENTS:
- This is for a CELEBRATION - present it elegantly without "diet language"
- Guest count: ${serving.count} guests
- Recommended tiers: ${serving.tiers || 3} tiers
- Focus on sophistication: subtle flavors, elegant presentation
- Include a "perSliceNutrition" object with per-slice values (assume 1 oz slice)
- Nutrition should be realistic for celebration portions
- Fillings should complement the occasion: champagne, elderflower, rose, lavender work well
- Avoid anything that sounds "healthy" or "diet" - this is a wedding!
- Include "tiers" field in response indicating recommended tier count
${isNakedCake && serving.count > 100 ? `
⚠️ NAKED CAKE STRUCTURAL WARNING:
- For ${serving.count}+ guests with naked style, recommend SEMI-NAKED instead of fully naked
- Naked cakes at this scale need structural support
- Use sturdier sponge recipes and consider dowel support between tiers
- Include this structural guidance in the instructions
` : ""}
` : ""}
${isCelebrationCake && !isWeddingCake ? `
CELEBRATION CAKE REQUIREMENTS:
- This is for a special occasion - make it feel special
- Include a "perSliceNutrition" object with per-slice values
- Balance indulgence with quality ingredients
` : ""}
` : "";

    const dessertIdentifier = hasCustomDescription
      ? customDessertDescription.trim()
      : (specificDessert || `${flavorFamily} ${dessertCategory}`);

    // ── Dish Adaptation Layer (Phase 5) ──────────────────────────────────────
    // For named desserts, anchor identity and cross-reference active guardrails
    // so "cheesecake + diabetic" adapts the cheesecake rather than replacing it.
    // Only runs when the user has requested a specific named dessert.
    let _dessertDishDirective: DishAdaptationDirective | null = null;
    const _dessertIsNamed = !!(specificDessert?.trim() || hasCustomDescription);
    if (_dessertIsNamed) {
      try {
        const _dessertGuardrailCtx = buildGuardrailContext({
          dietaryIdentity: [
            ...dessertEnvelope.dietaryIdentity,
            ...userDietaryRestrictions,
          ],
          allergies: dessertEnvelope.allergies,
          overriddenAllergens:
            _overriddenDessertAllergens.length > 0 ? _overriddenDessertAllergens : undefined,
        });
        _dessertDishDirective = await getDishAdaptationDirective(
          dessertIdentifier,
          _dessertGuardrailCtx,
          "first_pass",
        );
        if (_dessertDishDirective) {
          console.log(`[DESSERT] Dish adaptation policy loaded; requestId=${(req as any).id ?? "unavailable"}`);
        }
      } catch (dalErr) {
        console.warn(`[DESSERT] DISH_ADAPTATION_LOAD_FAILED; requestId=${(req as any).id ?? "unavailable"}`);
      }
    }

    const chefAdaptBlock = dietAdaptOverride === true
      ? `\n${buildChefAdaptationBlock(getPrimaryDiet(userDietaryRestrictions))}\n`
      : "";

    const softOverrideBlock = userDietOverride === true
      ? `\n[USER DIET SOFT OVERRIDE: The user has explicitly chosen to create this dessert despite their dietary preference. You MUST create the specifically requested dessert. Keep the serving size realistic. Do NOT add additional non-compliant ingredients beyond what is inherent to this dessert type.]\n`
      : "";

    // ── Behavioral memory: soft preference hints ──────────────────────────────
    let dessertBehavioralMemorySection = "";
    if (userId && userId !== "1") {
      try {
        const behavioralProfile = await derivePreferenceProfile(userId);
        if (behavioralProfile) {
          dessertBehavioralMemorySection = buildBehavioralMemoryPromptSection(behavioralProfile);
          console.log(`[DESSERT] Behavioral preferences loaded; requestId=${(req as any).id ?? "unavailable"}`);
        }
      } catch (err) {
        console.warn(`[DESSERT] BEHAVIORAL_PROFILE_LOAD_FAILED; requestId=${(req as any).id ?? "unavailable"}`);
      }
    }

    const prompt = `
${humanFoodPrompt}

You are a master pastry chef + nutrition expert inside the My Perfect Meals system.
Generate a FULL structured dessert recipe.
${dessertProtocolBlock ? `\n${dessertProtocolBlock}\n` : ""}${_dessertDishDirective ? `\n${_dessertDishDirective.adaptationBlock}\n` : ""}${sweetenerGuidance}${dessertBehavioralMemorySection ? `\n${dessertBehavioralMemorySection}\n` : ""}${chefAdaptBlock}${softOverrideBlock}${strictMode === true ? `\n${buildStrictModeBlock(dessertIdentifier)}\n` : ""}

Return JSON ONLY, following this exact schema:

{
  "name": "",
  "description": "",
  "ingredients": [
    {
      "name": "",
      "amount": "",
      "unit": ""
    }
  ],
  "instructions": "",
  "nutrition": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0
  },
  ${dessertCategory === "cake" ? `"perSliceNutrition": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "sliceSize": "1 oz"
  },
  "totalSlices": 0,${isWeddingCake ? `
  "tiers": ${serving.tiers || 3},` : ""}` : ""}
  "servingSize": "${serving.label}",
  "reasoning": "",
  "imageUrl": ""
}

CRITERIA:
${hasCustomDescription ? `- PRIMARY DESCRIPTION (highest priority): "${customDessertDescription.trim()}" — use this as the creative direction for the recipe. Create exactly what is described.
- Dessert CATEGORY (supplementary): "${categoryLabel || "derived from description"}"
- Flavor FAMILY (supplementary): "${flavorLabel || "derived from description"}"` : `- Dessert CATEGORY: "${categoryLabel}" (this defines the structure - pie, cake, cookies, etc.)
- Flavor FAMILY: "${flavorLabel}" (this defines the main taste direction)
- Specific dessert requested: "${specificDessert || "Create your own unique version"}"`}
- Dietary requirements: "${dietaryRules}"
- Number of servings: ${serving.count}
${cakeRulesBlock}
GENERATION RULES:
1. If a specific dessert is named (e.g., "key lime pie"), create a HEALTHY version of that exact dessert.
2. If no specific dessert is named, CREATE a unique dessert using the category + flavor combination.
3. Instructions must be step-by-step baking/cooking directions.
4. Nutrition must be realistic and scaled for the total serving count (${serving.count} servings).
5. Reasoning explains why this dessert fits the flavor profile + dietary needs.
6. imageUrl should be a short descriptive image prompt (no quotes).
7. Apply all dietary requirements strictly (e.g., if "gluten-free" is specified, use NO gluten ingredients).
${dessertCategory === "cake" ? `8. For CAKES: Include "perSliceNutrition" with nutrition per 1 oz slice, and "totalSlices" with the number of slices.` : ""}
${palateGuidance}

${getMeasurementPromptBlock((dessertMeasurementSystem) as MeasurementSystem)}
- DO NOT include macro/nutrition data in ingredient rows - macros go in the nutrition object only
`;

    if (isDev) console.log("[DESSERT] Calling OpenAI GPT-4o...");
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    if (isDev) console.log("[DESSERT] OpenAI response received");

    let meal: any;
    try {
      const rawText = completion.choices[0]?.message?.content || "{}";
      meal = JSON.parse(rawText);
      if (isDev) console.log("[DESSERT] Generated response parsed");
    } catch (parseErr) {
      console.error("Dessert Creator JSON parse error:", parseErr);
      return res
        .status(500)
        .json({ error: "AI returned invalid JSON for dessert" });
    }

    // ── Post-gen protocol scan ──────────────────────────────────────────────
    const dessertScan = scanGeneratedOutput(meal, dessertEnvelope, {
      generatorName: 'dessert_creator',
      skipAdaptableConflicts: dietAdaptOverride === true || userDietOverride === true,
      overriddenAllergens: _overriddenDessertAllergens.length > 0 ? _overriddenDessertAllergens : undefined,
    });
    if (!dessertScan.passed) {
        console.log(`[DESSERT] Generated result rejected by protocol; requestId=${(req as any).id ?? "unavailable"}`);
      return res.status(400).json({
        error: "PROTOCOL_VIOLATION",
        message: dessertScan.message,
        retryable: true,
      });
    }

    // ── Dish Identity Validator (Phase 5) ─────────────────────────────────────
    // Only runs for named desserts. A catastrophic deviation (completely wrong
    // culinary result) is surfaced as an explicit error — never silent fallback.
    if (_dessertIsNamed && meal) {
      try {
        const identityResult = validateDishIdentity(dessertIdentifier, meal, _dessertDishDirective);
        if (identityResult.catastrophicDeviation) {
          console.error(`[DESSERT] DISH_IDENTITY_REJECTED; requestId=${(req as any).id ?? "unavailable"}`);
          const conflictSummary = (_dessertDishDirective?.conflicts ?? [])
            .map(c => `${c.component} (${c.guardrail})`)
            .join(", ");
          return res.status(400).json({
            error: "DISH_IDENTITY_FAILURE",
            dishIdentityFailure: true,
            message:
              `We couldn't make "${dessertIdentifier}" within your current constraints` +
              (conflictSummary ? ` — conflicts: ${conflictSummary}` : "") +
              `. Rather than serve you a different dessert, we're being upfront: try adjusting your request or your safety settings.`,
            conflicts: _dessertDishDirective?.conflicts ?? [],
            retryable: true,
          });
        }
        console.log(`[DESSERT] Dish identity validated; requestId=${(req as any).id ?? "unavailable"}`);
      } catch (e) {
        console.warn(`[DESSERT] DISH_IDENTITY_VALIDATION_FAILED; requestId=${(req as any).id ?? "unavailable"}`);
      }
    }

    // Normalize ingredients to U.S. measurements (oz, cups, tbsp, tsp)
    const normalizedIngredients = normalizeIngredients(meal.ingredients || []);
    meal.ingredients = normalizedIngredients;

    const ingredientNames = normalizedIngredients.map((i: any) =>
      String(i.name ?? "").toLowerCase()
    );

    // Fetch user health conditions from database for medical badge generation
    let userConditions: string[] = [];
    if (userId && userId !== "1") {
      try {
        const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (dbUser?.healthConditions && Array.isArray(dbUser.healthConditions)) {
          userConditions = dbUser.healthConditions;
          console.log(`[DESSERT] Medical policy loaded; requestId=${(req as any).id ?? "unavailable"}`);
        }
      } catch (err) {
        console.warn(`[DESSERT] MEDICAL_POLICY_LOAD_FAILED; requestId=${(req as any).id ?? "unavailable"}`);
      }
    }

    const constraints: any = {
      lowGlycemicMode: dietaryPreferences?.includes("low-sugar") || false,
      conditions: userConditions,
    };

    const medicalBadges = computeMedicalBadges(constraints, ingredientNames);
    const alphaGalBadge = computeAlphaGalBadge(
      `${(meal as any).name || ""} ${(meal as any).description || ""}`,
      ingredientNames,
      userConditions
    );

    // Generate image server-inline via canonical pipeline (caching + fallback handled internally)
    let imageUrl: string | null = null;
    try {
      imageUrl = await generateMealImageUnified(meal.name, ingredientNames, "dessert");
    } catch (imgErr) {
      console.warn("[DESSERT] Image generation failed:", imgErr);
    }

    // Creator System 2-pass transformation — applied after all safety checks and normalization.
    if (userId && userId !== "1") {
      const creatorSystem = await resolveCreatorSystemForUser(userId);
      meal = await applyCreatorTransformation(meal, creatorSystem, "dessert");
    }

    if (isDev) console.log("[DESSERT] Sending response (image handled client-side)...");

    // Phase 3B: emit usage event — dessert was generated
    if (userId && userId !== "1") {
      emitActivityEvent({
        ownerUserId: String(userId),
        eventType: "dessert_generated",
        eventClass: "usage",
        sourceFeature: "dessert_creator",
        metadata: { dessertCategory, flavorFamily, specificDessert },
      }).catch((err) => console.error("[ActivityEvents]", err.message));
    }

    const { complianceSection: dessertCompliance, dietClassification: dessertDietClass } =
      buildMealComplianceBundle(meal, dessertEnvelope, { isChefAdapted: dietAdapted });
    const humanFoodValidation = validateCreatorHumanFoodResult("dessert_creator", meal, humanFoodContext);
    if (!humanFoodValidation.valid) {
      return res.status(422).json({
        code: "HUMAN_FOOD_CONTEXT_VALIDATION_FAILED",
        message: "The dessert did not pass final food-context validation.",
      });
    }
    return res.json({
      ...meal,
      imageUrl,
      medicalBadges,
      humanFoodContext: issueHumanFoodContextMeta(humanFoodContext),
      ...(alphaGalBadge && { alphaGalBadge }),
      ...(dietAdapted && { dietAdapted: true, dietNotice }),
      complianceSection: dessertCompliance,
      dietClassification: dessertDietClass,
      meta: {
        dessertCategory,
        flavorFamily,
        specificDessert,
        servingSize,
        cakeStyle: dessertCategory === "cake" ? cakeStyle : undefined,
        cakeType: dessertCategory === "cake" ? cakeType : undefined,
        dietaryPreferences,
      },
    });
  } catch (err: any) {
    console.error("Dessert Creator Error:", err);
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return res.status(status).json({
      error: status === 500 ? "Failed to create dessert" : err.message,
      ...(err?.code ? { code: err.code } : {}),
    });
  }
});

export default dessertCreatorRouter;
