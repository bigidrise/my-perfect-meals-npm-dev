import { Router } from "express";
import OpenAI from "openai";
import { getMeasurementPromptBlock, MeasurementSystem } from "../../shared/units";
import { computeMedicalBadges } from "../services/medicalBadges";
import { normalizeIngredients } from "../services/ingredientNormalizer";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { buildPalateSection, PalatePreferences } from "../services/promptBuilder";
import { resolveDietCategoryStrategy, type DietCategoryStrategy } from "../services/allergyGuardrails";
import { scanGeneratedOutput, buildMealComplianceBundle } from "../services/protocolEnvelope";
import { getActiveNutritionContext, type BuilderKey } from "../services/nutritionContext/getActiveNutritionContext";
import { type UserProtocolEnvelope } from "../services/protocolEnvelope";
import { derivePreferenceProfile, buildBehavioralMemoryPromptSection } from "../services/behavioralMemoryService";
import { resolveCreatorSystemForUser } from "../services/creatorSystems/resolveCreatorSystemForUser";
import { applyCreatorTransformation } from "../services/creatorSystems/applyCreatorTransformation";
import {
  buildBeveragePromptBlocks,
  validateBeverageOutput,
  attemptBeverageAutoFix,
} from "../services/guardrails/beverageMedicalRules";

// ─────────────────────────────────────────────────────────────────────────────

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

const beverageCreatorRouter = Router();

const SERVING_MULTIPLIERS: Record<string, { count: number; label: string }> = {
  single: { count: 1, label: "1 drink" },
  two: { count: 2, label: "2 drinks" },
  pitcher: { count: 5, label: "Pitcher (4–6 drinks)" },
  party: { count: 10, label: "Party Batch (8–12 drinks)" },
};

const CATEGORY_LABELS: Record<string, string> = {
  cocktail: "Cocktail",
  mocktail: "Mocktail",
  smoothie: "Smoothie",
  "protein-shake": "Protein Shake",
  milkshake: "Milkshake",
  coffee: "Coffee Drink",
  tea: "Tea Drink",
  frozen: "Frozen Drink",
  hydration: "Hydration Drink",
};

const FLAVOR_LABELS: Record<string, string> = {
  citrus: "Citrus",
  berry: "Berry",
  tropical: "Tropical",
  chocolate: "Chocolate",
  vanilla: "Vanilla",
  coffee: "Coffee",
  caramel: "Caramel",
  herbal: "Herbal",
  spicy: "Spicy",
};

const isDev = process.env.NODE_ENV === "development";

// ── Classify free-text description into a beverage category ──────────────────
// Used when hasCustomDesc is true so the prompt gets the same category-specific
// rules as the dropdown path. Never guesses food — defaults to "frozen" for
// blended drinks and "cocktail" as a last resort.
function classifyBeverageIntent(text: string): string {
  const t = text.toLowerCase();
  if (/smoothie|blend|acai|banana\s+shake/.test(t)) return "smoothie";
  if (/protein.shake|whey|mass.gainer|post.workout.shake/.test(t)) return "protein-shake";
  if (/milkshake|milk\s+shake|ice\s+cream\s+shake/.test(t)) return "milkshake";
  if (/latte|espresso|cold\s+brew|americano|cappuccino|macchiato|frappuccino|coffee/.test(t)) return "coffee";
  if (/matcha|chai|green\s+tea|black\s+tea|herbal\s+tea|iced\s+tea|tea/.test(t)) return "tea";
  if (/margarita|daiquiri|mojito|martini|sangria|cosmo|cosmopolitan|whiskey\s+sour|negroni|spritz|mimosa|bloody\s+mary|pina\s+colada|rum|vodka|gin|tequila|whiskey|whisky|bourbon|wine|beer|champagne|cocktail/.test(t)) return "cocktail";
  if (/mocktail|virgin|alcohol.free|non.alcoholic/.test(t)) return "mocktail";
  if (/lemonade|juice|agua\s+fresca|electrolyte|hydration|sports\s+drink|kombucha|infused\s+water/.test(t)) return "hydration";
  if (/frozen|slushie|slush|frappe|blended|icee/.test(t)) return "frozen";
  // No strong signal — use "frozen" as safe generic drink default
  return "frozen";
}

beverageCreatorRouter.post("/", async (req, res) => {
  if (isDev) console.log("[BEVERAGE] POST request received");
  try {
    const {
      beverageCategory,
      flavorFamily,
      specificDrink,
      customBeverageDescription,
      servingSize,
      dietaryPreferences,
      userId,
      safetyMode,
      overrideToken,
      skipPalate,
      dietAdaptOverride,
      userDietOverride,
      cultureOverride: _cultureOverride,
      cuisineOverride: _cuisineOverride,
    } = req.body ?? {};

    // Accept either key name — some clients send cuisineOverride, others cultureOverride
    const cultureOverride: string | undefined = (_cultureOverride || _cuisineOverride) ?? undefined;

    if (isDev) console.log("[BEVERAGE] Request params:", { beverageCategory, flavorFamily, servingSize, hasCustomDesc: typeof customBeverageDescription === "string" && customBeverageDescription.trim().length > 0 });

    const hasCustomDesc = typeof customBeverageDescription === "string" && customBeverageDescription.trim().length > 0;

    if (!hasCustomDesc && !beverageCategory) {
      return res.status(400).json({ error: "Beverage category is required" });
    }

    if (!hasCustomDesc && !flavorFamily) {
      return res.status(400).json({ error: "Flavor family is required" });
    }

    let dietAdapted = false;
    let dietNotice = "";
    if (userId) {
      const inputText = [customBeverageDescription, specificDrink, flavorFamily, beverageCategory].filter(Boolean).join(' ');
      const safetyCheck = await enforceSafetyProfile(userId, inputText, "beverage-creator", {
        safetyMode: safetyMode || "STRICT",
        overrideToken: overrideToken
      });
      if (safetyCheck.result === "BLOCKED") {
        console.log(`🚫 [SAFETY] Blocked beverage for user ${userId}: ${safetyCheck.blockedTerms.join(", ")}`);
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
    }

    // ── Load unified nutrition context (protocol + active builder) ────────────
    const beverageContext = await getActiveNutritionContext(userId);
    const beverageEnvelope = beverageContext.envelope;
    const beverageProtocolBlock = beverageContext.combinedBlock;
    console.log(`🔒 [BEVERAGE] Nutrition context: diet=[${beverageContext.diet.join(",")}] medical=[${beverageContext.medical.length} flags] builder=${beverageContext.builder ?? "none"}`);

    let palateGuidance = "\nFLAVOR STYLE: Use light, neutral flavoring suitable for serving to guests or family.";
    let dietCategoryStrategy: DietCategoryStrategy = {
      conflictLevel: 'none',
      effectiveCategory: beverageCategory,
      requestedCategory: beverageCategory,
      coachingBlock: '',
    };

    // Use envelope's dietaryIdentity for cocktail-vs-mocktail redirect intelligence
    let activeRestrictions: string[] = beverageEnvelope.dietaryIdentity;
    let beverageMeasurementSystem: MeasurementSystem = "imperial";

    if (userId && userId !== "1") {
      try {
        const [user] = await db.select({
          palateSpiceTolerance: users.palateSpiceTolerance,
          palateSeasoningIntensity: users.palateSeasoningIntensity,
          palateFlavorStyle: users.palateFlavorStyle,
          measurementSystem: users.measurementSystem,
        }).from(users).where(eq(users.id, userId)).limit(1);
        
        if (user) {
          beverageMeasurementSystem = (user.measurementSystem as MeasurementSystem) ?? "imperial";
          if (!skipPalate && (user.palateSpiceTolerance || user.palateSeasoningIntensity || user.palateFlavorStyle)) {
            const palatePrefs: PalatePreferences = {
              palateSpiceTolerance: user.palateSpiceTolerance as PalatePreferences['palateSpiceTolerance'],
              palateSeasoningIntensity: user.palateSeasoningIntensity as PalatePreferences['palateSeasoningIntensity'],
              palateFlavorStyle: user.palateFlavorStyle as PalatePreferences['palateFlavorStyle'],
            };
            palateGuidance = `\nFLAVOR PREFERENCES: ${buildPalateSection(palatePrefs)}`;
            console.log(`🎨 [BEVERAGE] Loaded palate preferences for user`);
          }
        }
      } catch (err) {
        console.log("[BEVERAGE] Could not fetch user preferences:", err);
      }
    } else if (skipPalate) {
      console.log(`🎨 [BEVERAGE] Palate preferences skipped - using neutral flavoring for shared drink`);
    }

    // Merge body-sent dietaryPreferences into active restrictions as fallback
    if (dietaryPreferences) {
      const bodyRestrictions = (Array.isArray(dietaryPreferences) ? dietaryPreferences : [dietaryPreferences]).filter(Boolean);
      if (bodyRestrictions.length > 0) {
        const merged = new Set([...activeRestrictions, ...bodyRestrictions]);
        activeRestrictions = Array.from(merged);
      }
    }

    // Resolve diet × category strategy — coaching intelligence layer
    // Silently redirects incompatible category/diet combos (e.g. halal → mocktail)
    if (activeRestrictions.length > 0) {
      dietCategoryStrategy = resolveDietCategoryStrategy(activeRestrictions, beverageCategory);
      if (dietCategoryStrategy.conflictLevel !== 'none') {
        console.log(`🔀 [BEVERAGE] Diet-category ${dietCategoryStrategy.conflictLevel}: ${beverageCategory} → ${dietCategoryStrategy.effectiveCategory} (diet: ${activeRestrictions.join("|")})`);
      }
    }

    const serving = SERVING_MULTIPLIERS[servingSize] || SERVING_MULTIPLIERS.single;
    // When free-text is used, classify it into a beverage category so the same
    // strict category rules apply as in the dropdown path.
    const inferredCategory = hasCustomDesc ? classifyBeverageIntent(customBeverageDescription) : null;
    // Use effectiveCategory for generation (may differ from requested for redirect cases)
    const effectiveCategory = inferredCategory ?? dietCategoryStrategy.effectiveCategory;
    const categoryLabel = CATEGORY_LABELS[effectiveCategory] || effectiveCategory;
    const flavorLabel = FLAVOR_LABELS[flavorFamily] || flavorFamily;
    const dietaryRules = Array.isArray(dietaryPreferences) && dietaryPreferences.length > 0
      ? dietaryPreferences.map((d: string) => d.replace(/-/g, " ")).join(", ")
      : "none specified";

    const categorySpecificRules = (() => {
      switch (effectiveCategory) {
        case "cocktail":
          return `\n🍸 COCKTAIL-SPECIFIC RULES:
- Generate a balanced cocktail with correct alcohol ratios
- Include the specific spirit/liquor base
- Use proper bartending measurements (oz, dashes, parts)
- Include garnish instructions
- If serving size is pitcher or party batch, scale proportionally`;
        case "mocktail":
          return `\n🥤 MOCKTAIL-SPECIFIC RULES:
- Must be completely alcohol-free
- Use creative flavor combinations that feel sophisticated
- Include garnish and presentation notes`;
        case "smoothie":
          return `\n🥝 SMOOTHIE-SPECIFIC RULES:
- Prioritize whole fruits and natural sweetness
- Include a liquid base (milk, juice, water, coconut water)
- Suggest optional add-ins (chia seeds, flax, etc.)`;
        case "protein-shake":
          return `\n💪 PROTEIN SHAKE-SPECIFIC RULES:
- Prioritize macro balance and protein density
- Include protein source (whey, plant protein, Greek yogurt, etc.)
- Target at least 20g protein per serving
- Keep ingredients practical and available`;
        case "milkshake":
          return `\n🍦 MILKSHAKE-SPECIFIC RULES:
- Rich, indulgent, and satisfying
- Include ice cream or frozen yogurt base
- Include topping/garnish suggestions`;
        case "coffee":
          return `\n☕ COFFEE DRINK-SPECIFIC RULES:
- Specify coffee type (espresso, cold brew, drip, etc.)
- Use ONLY plant-based milk/cream (oat milk, almond milk, soy milk, coconut milk) — NEVER dairy milk or cream
- Include sweetener amounts if applicable`;
        case "tea":
          return `\n🍵 TEA DRINK-SPECIFIC RULES:
- Specify tea type (green, black, herbal, matcha, chai, etc.)
- Include steeping instructions or preparation method
- Temperature guidance (hot or iced)`;
        case "frozen":
          return `\n🧊 FROZEN DRINK-SPECIFIC RULES:
- Must be blended or frozen
- Include ice quantities
- Specify blending instructions`;
        case "hydration":
          return `\n💧 HYDRATION DRINK-SPECIFIC RULES:
- Focus on electrolytes and hydration benefits
- Use natural ingredients where possible
- Include health benefits in reasoning`;
        default:
          return "";
      }
    })();

    const softOverrideBlock = userDietOverride === true
      ? `\n[USER DIET SOFT OVERRIDE: The user has explicitly chosen to make this beverage despite their dietary preference. You MUST create the specifically requested drink. Keep the serving size realistic. Do NOT add additional non-compliant ingredients beyond what is inherent to this beverage type.]\n`
      : "";

    // ── Behavioral memory: soft preference hints ──────────────────────────────
    let beverageBehavioralMemorySection = "";
    if (userId && userId !== "1") {
      try {
        const behavioralProfile = await derivePreferenceProfile(userId);
        if (behavioralProfile) {
          beverageBehavioralMemorySection = buildBehavioralMemoryPromptSection(behavioralProfile);
          console.log(`🧠 [BehavioralMemory/Beverage] Profile loaded — ${behavioralProfile.auditMeta.evidenceCount} signals`);
        }
      } catch (err) {
        console.warn("⚠️ [BehavioralMemory/Beverage] Could not derive preference profile:", err);
      }
    }

    // ── Cuisine intensity — read from user's profile envelope ─────────────────
    // This is the same intensity the user set for meals. "light" means same drink,
    // lighter base ingredients (plant milk over whole milk, yogurt over ice cream,
    // minimal sweetener). "authentic" means traditional ingredients from that culture.
    const beverageCuisineIntensity = beverageEnvelope.cuisineIntensity ?? "balanced";

    const BEVERAGE_INTENSITY_DEPTH: Record<string, string> = {
      light: `Apply the cultural FLAVOR identity fully (spices, fruits, herbs, aromatics, teas) — but lighten the BASE ingredients only.
  - REQUIRED BASE SWAPS: full-fat ice cream → frozen banana or low-fat yogurt; whole milk → oat milk, almond milk, soy milk, or low-fat milk; heavy cream → low-fat milk or plant milk; butter → none.
  - SWEETENER: Skip added syrups and honey entirely. Use natural fruit sweetness. If a small sweetener is needed, use ½ tsp honey or 1 tsp agave — no more.
  - The drink NAME, CATEGORY, and CULTURAL FLAVOR PROFILE stay identical. Do NOT change a Korean citrus drink to water with lime. Do NOT change a milkshake to a smoothie. Keep the cultural flavor — change what carries it.
  - If a milkshake is requested: make the lightest possible version (frozen banana + low-fat milk + cultural flavoring) — NEVER full-fat ice cream.`,
      balanced: `Apply the cultural flavor identity fully — spices, fruits, herbs, aromatics — with health-aware base choices. Prefer lower-fat dairy or plant milk over heavy cream or whole milk. Moderate natural sweetening. Cultural ingredients are preserved; the base is optimized for balance.`,
      authentic: `Apply strict cultural authenticity — use traditional ingredients, flavor combinations, and preparation methods from this cuisine. Traditional bases (full-fat dairy, honey, traditional sweeteners, coconut milk) are permitted unless overridden by the user's active medical or dietary constraints.`,
    };

    const cuisineOverrideBlock = cultureOverride && typeof cultureOverride === "string" && cultureOverride.trim()
      ? `\n🌍 CUISINE STYLE (${beverageCuisineIntensity.toUpperCase()}): Create a ${cultureOverride.trim()}-influenced beverage.\n${BEVERAGE_INTENSITY_DEPTH[beverageCuisineIntensity] ?? BEVERAGE_INTENSITY_DEPTH.balanced}\n`
      : "";

    console.log(`🌍 [BEVERAGE] Cuisine: override=${cultureOverride ?? "none"} intensity=${beverageCuisineIntensity}`);

    // ── Medical beverage enforcement — ingredient-level rules for every active condition ──
    // buildBeveragePromptBlocks() uses the same structured rule registry as the
    // post-generation validator, ensuring prompt intent and validation enforcement
    // are always in sync (one source of truth in beverageMedicalRules.ts).
    const medicalBeverageBlock = buildBeveragePromptBlocks(
      beverageEnvelope,
      beverageContext.builder,
    );

    const prompt = `
You are a professional mixologist, nutritionist, and beverage chef inside the My Perfect Meals system.
Generate a FULL structured beverage recipe.
${beverageProtocolBlock ? `\n${beverageProtocolBlock}\n` : ""}${medicalBeverageBlock}${cuisineOverrideBlock}${beverageBehavioralMemorySection ? `\n${beverageBehavioralMemorySection}\n` : ""}${dietCategoryStrategy.coachingBlock ? `\n${dietCategoryStrategy.coachingBlock}\n` : ""}${softOverrideBlock}
The result MUST be a drink. Never generate solid food, meals, or desserts.

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
  "servingSize": "${serving.label}",
  "reasoning": "",
  "imageUrl": ""
}

CRITERIA:
${hasCustomDesc ? `- User's custom beverage idea: "${customBeverageDescription}" (this takes FULL priority)
- Classified drink type: ${categoryLabel} — apply ALL ${categoryLabel}-specific rules below strictly
- 🚨 MANDATORY: Generate a ${categoryLabel} ONLY. This is a DRINK. Never return eggs, solid food, snacks, meals, or baked goods.` : `- Beverage CATEGORY: "${categoryLabel}" (this defines the drink type)
- Flavor FAMILY: "${flavorLabel}" (this defines the main taste direction)
- Specific drink requested: "${specificDrink || "Create your own unique version"}"`}
- Dietary requirements: "${dietaryRules}"
- Number of servings: ${serving.count}
${categorySpecificRules}

GENERATION RULES:
1. The output MUST be a DRINK — never solid food, baked goods, or desserts.
2. If a specific drink is named (e.g., "mojito", "matcha latte"), create that exact drink.
3. If no specific drink is named, CREATE a unique beverage using the category + flavor combination.
4. Instructions must be clear, step-by-step preparation directions.
5. Nutrition must be realistic and scaled for the total serving count (${serving.count} servings).
6. Reasoning explains why this beverage fits the flavor profile + dietary needs.
7. imageUrl should be a short descriptive image prompt (no quotes).
8. Apply all dietary requirements strictly.
${palateGuidance}

${getMeasurementPromptBlock((beverageMeasurementSystem) as MeasurementSystem)}
- Whole items: use "each" (e.g., "1 each lime", "2 each mint sprigs")
- DO NOT include macro/nutrition data in ingredient rows - macros go in the nutrition object only
`;

    if (hasCustomDesc && inferredCategory) {
      console.log(`🍹 [BEVERAGE] Free-text classified as "${inferredCategory}" (input: "${customBeverageDescription.substring(0, 60)}")`);
    }

    // ── Solid-food guard — fast-fail before sending bad output ─────────────────
    const SOLID_FOOD_SIGNALS = /\begg(s)?\b|\bchicken breast\b|\bground beef\b|\bpasta\b|\brice\b|\bpizza\b|\btaco\b|\bbread\b|\btoast\b|\bsalad\b|\bsoup\b|\bsteak\b|\bsalmon fillet\b|\bpork\b/i;
    function isSolidFood(meal: any): boolean {
      const nameHit = SOLID_FOOD_SIGNALS.test(meal.name || "");
      const ingredientHit = (meal.ingredients || []).some((i: any) =>
        SOLID_FOOD_SIGNALS.test(typeof i === "string" ? i : (i.name || ""))
      );
      return nameHit || ingredientHit;
    }

    // Three attempts:
    //   Attempt 1 — normal generation
    //   Attempt 2 — appends specific protocol or clinical violation hint
    //   Attempt 3 — appends combined hint if still failing (last chance)
    const MAX_BEVERAGE_ATTEMPTS = 3;
    let meal: any;
    let beverageScan: ReturnType<typeof scanGeneratedOutput> | null = null;
    let beverageValidation: ReturnType<typeof validateBeverageOutput> | null = null;

    for (let attempt = 1; attempt <= MAX_BEVERAGE_ATTEMPTS; attempt++) {
      // Build the retry hint from whichever validator failed last round.
      // Clinical validator (beverage-specific ingredient bans) takes priority
      // because its hints are more specific and corrective than the generic scan.
      let retryHint = "";
      if (attempt > 1) {
        if (beverageValidation && !beverageValidation.passed) {
          retryHint = beverageValidation.retryHint;
        } else if (beverageScan && !beverageScan.passed) {
          retryHint =
            `\n\nPREVIOUS ATTEMPT VIOLATION — fix this before generating:\n` +
            `${beverageScan.message}\n` +
            `Ensure every ingredient and the drink name are fully compliant with the dietary rules above.`;
        }
      }

      if (isDev) console.log(`[BEVERAGE] Calling OpenAI GPT-4o (attempt ${attempt})...`);
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt + retryHint }],
        response_format: { type: "json_object" },
      });
      if (isDev) console.log("[BEVERAGE] OpenAI response received");

      try {
        const rawText = completion.choices[0]?.message?.content || "{}";
        meal = JSON.parse(rawText);
        if (isDev) console.log("[BEVERAGE] Parsed beverage:", meal.name);
      } catch (parseErr) {
        console.error("Beverage Creator JSON parse error:", parseErr);
        return res.status(500).json({ error: "AI returned invalid JSON for beverage" });
      }

      // ── Layer 1: Solid-food fast-fail guard ───────────────────────────────
      if (isSolidFood(meal)) {
        console.warn(`🚨 [BEVERAGE] Solid food detected in output ("${meal.name}") — attempt ${attempt}. Forcing retry.`);
        if (attempt >= MAX_BEVERAGE_ATTEMPTS) {
          return res.status(400).json({
            error: "INVALID_BEVERAGE",
            message: "The generator produced food instead of a drink. Please try again or use the dropdown.",
            retryable: true,
          });
        }
        beverageScan = { passed: false, message: `Output was food ("${meal.name}"), not a beverage. You MUST generate a ${categoryLabel} drink.` } as any;
        beverageValidation = null;
        continue;
      }

      // ── Layer 2: Post-gen protocol scan (dietary restriction compliance) ──
      beverageScan = scanGeneratedOutput(meal, beverageEnvelope, {
        generatorName: 'beverage_creator',
        skipAdaptableConflicts: dietAdaptOverride === true || userDietOverride === true,
      });

      if (!beverageScan.passed) {
        console.log(`🚫 [BEVERAGE] Protocol violation (attempt ${attempt}): ${beverageScan.message}`);
        beverageValidation = null;
        if (attempt >= MAX_BEVERAGE_ATTEMPTS) {
          return res.status(400).json({
            error: "PROTOCOL_VIOLATION",
            message: beverageScan.message,
            retryable: true,
          });
        }
        continue;
      }

      // ── Layer 3: Clinical medical validator (ingredient-level hard bans) ──
      // Runs only when the protocol scan passes. Checks the generated ingredient
      // list against the structured ban registry in beverageMedicalRules.ts.
      // This is the system-controlled enforcement gate — not AI guidance.
      beverageValidation = validateBeverageOutput(
        meal,
        beverageEnvelope,
        beverageContext.builder,
      );

      if (!beverageValidation.passed) {
        console.warn(
          `🚨 [BEVERAGE] Clinical validation failed (attempt ${attempt}): ` +
          beverageValidation.violations.map(v => `[${v.condition}] ${v.ingredient}`).join("; ")
        );

        // ── Auto-fix: surgical ingredient swap before burning an OpenAI retry ──
        // Only fires for simple non-alcohol violations with a known safe swap.
        // If the fix resolves all violations the loop breaks immediately —
        // zero extra latency, zero extra token cost.
        const autoFix = attemptBeverageAutoFix(meal, beverageValidation.violations);
        if (autoFix) {
          const fixedValidation = validateBeverageOutput(meal, beverageEnvelope, beverageContext.builder);
          if (fixedValidation.passed) {
            console.log(`✅ [BEVERAGE] Auto-fixed ${autoFix.fixes.length} violation(s): ${autoFix.note}`);
            beverageValidation = fixedValidation;
            break;
          }
          console.log(`⚠️ [BEVERAGE] Auto-fix applied but re-validation still failed — falling through to retry`);
        }

        if (attempt >= MAX_BEVERAGE_ATTEMPTS) {
          return res.status(400).json({
            error: "CLINICAL_VIOLATION",
            message:
              `This beverage cannot be generated safely for your health profile. ` +
              `Violations: ${beverageValidation.violations.map(v => v.rule).join("; ")}`,
            retryable: true,
          });
        }
        continue;
      }

      // All three layers passed — output is clean
      break;
    }

    const normalizedIngredients = normalizeIngredients(meal.ingredients || []);
    meal.ingredients = normalizedIngredients;

    const ingredientNames = normalizedIngredients.map((i: any) =>
      String(i.name ?? "").toLowerCase()
    );

    let userConditions: string[] = [];
    if (userId && userId !== "1") {
      try {
        const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (dbUser?.healthConditions && Array.isArray(dbUser.healthConditions)) {
          userConditions = dbUser.healthConditions;
          console.log("[BEVERAGE] User medical profile loaded");
        }
      } catch (err) {
        console.log("[BEVERAGE] Could not fetch user health conditions:", err);
      }
    }

    const constraints: any = {
      lowGlycemicMode: dietaryPreferences?.includes("low-sugar") || false,
      conditions: userConditions,
    };

    const medicalBadges = computeMedicalBadges(constraints, ingredientNames);

    // Image is generated client-side in parallel via /api/meals/generate-image
    const imageUrl = null;

    // Creator System 2-pass transformation — applied after all safety checks and normalization.
    if (userId && userId !== "1") {
      const creatorSystem = await resolveCreatorSystemForUser(userId);
      meal = await applyCreatorTransformation(meal, creatorSystem, "beverage");
    }

    if (isDev) console.log("[BEVERAGE] Sending response (image handled client-side)...");
    const { complianceSection: bevCompliance, dietClassification: bevDietClass } =
      buildMealComplianceBundle(meal, beverageEnvelope, { isChefAdapted: dietAdapted });
    return res.json({
      ...meal,
      imageUrl,
      medicalBadges,
      ...(dietAdapted && { dietAdapted: true, dietNotice }),
      complianceSection: bevCompliance,
      dietClassification: bevDietClass,
      ...(dietCategoryStrategy.conflictLevel !== 'none' && {
        dietCategoryConflict: dietCategoryStrategy.conflictLevel,
        requestedCategory: dietCategoryStrategy.requestedCategory,
        effectiveCategory: dietCategoryStrategy.effectiveCategory,
      }),
      meta: {
        userId: userId ?? "1",
        beverageCategory,
        flavorFamily,
        specificDrink,
        servingSize,
        dietaryPreferences,
      },
    });
  } catch (err: any) {
    console.error("Beverage Creator Error:", err);
    return res.status(500).json({ error: "Failed to create beverage" });
  }
});

export default beverageCreatorRouter;
