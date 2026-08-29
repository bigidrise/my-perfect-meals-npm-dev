import { Router } from "express";
import OpenAI from "openai";
import { getMeasurementPromptBlock, MeasurementSystem } from "../../shared/units";
import { computeMedicalBadges, computeAlphaGalBadge } from "../services/medicalBadges";
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
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { emitActivityEvent } from "../services/coaching/activityEvents";
import {
  buildBeveragePromptBlocks,
  containsAlcoholContent,
  validateBeverageOutput,
  attemptBeverageAutoFix,
} from "../services/guardrails/beverageMedicalRules";
import { buildAcePromptBlock } from "../services/ace/buildAcePromptBlock";
import { resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";
import { getLanguageInstruction } from "../utils/languageInstruction";
import { getDishAdaptationDirective, buildGuardrailContext } from "../services/dishAdaptation/dishAdaptationLayer";
import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";
import {
  BEVERAGE_DIET_FIT_EXPLANATION_INSTRUCTION,
  ensureBeverageDietTitle,
} from "../services/beverageTitle";
import {
  buildBeverageAlternativePrompt,
  getBeverageRejectionKind,
  getKnownBeverageProtocolName,
  shouldOfferBeverageAlternatives,
  type BeverageProtocolRejection,
} from "../services/beverageAlternativeSupport";
import { verifyHydrationHandoff } from "../services/hydration/hydrationHandoffService";
import { resolveHydrationDay } from "../services/hydration/hydrationDay";
import { getCurrentLiquidNutritionProtocol } from "../services/hydration/liquidNutritionProtocolService";
import {
  buildHydrationConsideredForYou,
  buildLiquidNutritionPromptBlock,
  validateLiquidNutritionOutput,
} from "../services/hydration/hydrationContextService";

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
  "dive-bar": "Dive Bar",
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
  if (/dive\s*bar|neighborhood\s+bar|bar\s+drink/.test(t)) return "dive-bar";
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
      userId: _bodyUserId, // ignored — safety/clinical identity always comes from req.authUser
      safetyMode,
      overrideToken,
      skipPalate,
      dietAdaptOverride,
      userDietOverride,
      dietOverride,          // builder hub diet override — replaces profile primary diet
      cultureOverride: _cultureOverride,
      cuisineOverride: _cuisineOverride,
      hydrationHandoff,
    } = req.body ?? {};

    // Always use the authenticated identity for all clinical, safety, and profile
    // lookups — the body-supplied userId is discarded to prevent IDOR.
    const userId = String((req as any).authUser?.id ?? "");
    let trustedHydrationHandoff: ReturnType<typeof verifyHydrationHandoff> | null = null;
    if (hydrationHandoff) {
      try {
        trustedHydrationHandoff = verifyHydrationHandoff({
          token: String(hydrationHandoff),
          userId,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        const status = code === "HYDRATION_HANDOFF_WRONG_ACCOUNT"
          ? 403
          : code === "HYDRATION_HANDOFF_EXPIRED"
            ? 410
            : 400;
        return res.status(status).json({
          error: code === "HYDRATION_HANDOFF_EXPIRED"
            ? "This Hydration handoff has expired. Return to Hydration Hub to start again."
            : "This Hydration handoff is not valid for the current account.",
        });
      }
    }

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
    // Allergen-specific override for this request only. All other allergies remain enforced.
    let _overriddenBeverageAllergens: string[] = [];
    if (userId) {
      const inputText = [customBeverageDescription, specificDrink, flavorFamily, beverageCategory].filter(Boolean).join(' ');
      const safetyCheck = await enforceSafetyProfile(userId, inputText, "beverage-creator", {
        safetyMode: safetyMode || "STRICT",
        overrideToken: overrideToken,
        correlationId: (req as any).id
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
      if (safetyCheck.overriddenAllergen) {
        _overriddenBeverageAllergens = [safetyCheck.overriddenAllergen];
        console.log(`[AllergyOverride] Beverage-creator request-scoped override — allergen: ${safetyCheck.overriddenAllergen}`);
      }
    }

    // ── Load unified nutrition context (protocol + active builder) ────────────
    const beverageContext = await getActiveNutritionContext(userId);
    const beverageEnvelope = beverageContext.envelope;
    const beverageProtocolBlock = beverageContext.combinedBlock;
    console.log(`🔒 [BEVERAGE] Nutrition context: diet=[${beverageContext.diet.join(",")}] medical=[${beverageContext.medical.length} flags] builder=${beverageContext.builder ?? "none"}`);
    const hydrationDay = await resolveHydrationDay({ subjectUserId: userId });
    const activeLiquidProtocol = await getCurrentLiquidNutritionProtocol({
      userId,
      localDate: hydrationDay.localDate,
    });
    if (activeLiquidProtocol?.status === "active" && !activeLiquidProtocol.handoffAllowed) {
      return res.status(409).json({
        error: "LIQUID_NUTRITION_VERIFICATION_REQUIRED",
        message:
          "Your active Liquid Nutrition instructions must be professionally verified and complete before Beverage Creator can safely use them.",
        consideredForYou: buildHydrationConsideredForYou({
          envelope: beverageEnvelope,
          builder: beverageContext.builder,
          liquidProtocol: activeLiquidProtocol,
        }),
      });
    }
    const liquidNutritionBlock = buildLiquidNutritionPromptBlock(activeLiquidProtocol);
    const hydrationHandoffBlock = trustedHydrationHandoff
      ? `\nVERIFIED HYDRATION HUB HANDOFF (${trustedHydrationHandoff.door}):\n${trustedHydrationHandoff.description}\nRe-resolve and enforce all current saved constraints; the handoff is intent only.\n`
      : "";

    let palateGuidance = "\nFLAVOR STYLE: Use light, neutral flavoring suitable for serving to guests or family.";
    let dietCategoryStrategy: DietCategoryStrategy = {
      conflictLevel: 'none',
      effectiveCategory: beverageCategory,
      requestedCategory: beverageCategory,
      coachingBlock: '',
    };

    // ── Builder diet override — REPLACES profile primary diet for this generation ──
    // Hard restrictions (allergies, medical, specialty, religious) remain enforced
    // by the protocol envelope and safety layer regardless of this override.
    // The override does NOT modify the saved profile.
    let activeRestrictions: string[] = beverageEnvelope.dietaryIdentity;
    if (dietOverride && typeof dietOverride === "string" && dietOverride.trim()) {
      activeRestrictions = [dietOverride.trim()];
      console.log(`🔀 [BEVERAGE] Diet override active: "${dietOverride.trim()}" replaces profile diet [${beverageEnvelope.dietaryIdentity.join(",")}]`);
    }
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
    const requestedCategoryLabel =
      CATEGORY_LABELS[beverageCategory] || beverageCategory || categoryLabel;
    const flavorLabel = FLAVOR_LABELS[flavorFamily] || flavorFamily;
    // INVARIANT: dietary identity always comes from the stored profile (activeRestrictions).
    // Body-supplied dietaryPreferences are already merged into activeRestrictions above.
    // Never allow "none specified" when the user has a stored dietary identity.
    const dietaryRules = activeRestrictions.length > 0
      ? activeRestrictions.map((d: string) => d.replace(/-/g, " ")).join(", ")
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
        case "dive-bar":
          return `\n🍺 DIVE BAR-SPECIFIC RULES:
- Design a drink that a normal neighborhood dive bar could realistically make with its everyday bar stock.
- Favor common vodka, gin, rum, tequila, whiskey/bourbon, common beer, basic wine, cola, lemon-lime soda, ginger ale, tonic, soda water, cranberry, orange, pineapple, grapefruit, tomato juice, and simple lemon or lime.
- Prefer highballs, simple mixed drinks, shots, basic cocktails, boilermakers or beer combinations, and straightforward two- or three-ingredient drinks.
- Use common basic liqueurs only when they are reasonably expected behind a standard bar.
- Keep preparation simple: standard glassware, ice, a pour, a stir, a shake, or a basic beer combination.
- Do not use specialty syrups, obscure liqueurs, elaborate garnishes, exotic ingredients, molecular techniques, or advanced equipment.
- Keep the drink practical and recognizable rather than making it resemble a craft cocktail lounge creation.`;
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

    // ── Canonical GLP-1 personalized beverage targets ─────────────────────────
    // Loaded server-side from resolveGLP1GlobalContext so beverage calorie /
    // protein / fat ceilings match the patient-specific values used by every
    // other generation surface (same resolver, same clinical rules).
    //
    // The custom beverage GLP-1 block above handles ingredient-level rules
    // (single serving, no added sugar, etc.).  This block adds the macro-target
    // layer on top so a GLP-1 user gets the same personalized ceilings in
    // Beverage Creator that they get in the meal builders and the unified route.
    let glp1CanonicalBlock = "";
    let beverageGlp1Active = false;
    // Stored outside the try block so the post-generation validator can use it.
    let beverageGlp1ResolvedTargets: import("../services/glp1/resolveGLP1MealTargets").ResolvedGLP1Targets | null = null;
    if (userId) {
      try {
        const glp1Ctx = await resolveGLP1GlobalContext(
          userId,
          new Date().toISOString().split("T")[0],
          // Beverages are portion-equivalent to snacks for GLP-1 sizing
          "snack",
        );
        beverageGlp1Active = glp1Ctx.isActive;
        if (glp1Ctx.isActive && !glp1Ctx.resolvedTargets) {
          throw new Error("[GLP-1] Active GLP-1 patient detected but clinical targets unavailable — generation blocked");
        }
        if (glp1Ctx.isActive && glp1Ctx.resolvedTargets) {
          beverageGlp1ResolvedTargets = glp1Ctx.resolvedTargets;
          const t = glp1Ctx.resolvedTargets;
          const phaseNote =
            t.treatmentPhase !== "unknown"
              ? ` [${t.treatmentPhase.replace("_", " ")} phase]`
              : "";
          const appetiteNote =
            t.appetiteLevel !== "normal"
              ? ` — appetite: ${t.appetiteLevel}`
              : "";
          glp1CanonicalBlock =
            `\n💊 GLP-1 PATIENT-SPECIFIC BEVERAGE TARGETS${phaseNote}:\n` +
            `- Calorie target: ~${t.resolvedSnackCalories} kcal (personalized from this patient's daily budget)\n` +
            `- Fat ceiling: ${t.maximumToleratedFatGrams}g maximum / ${t.targetFatGrams}g target` +
            ` (high fat is the primary nausea trigger — enforce strictly)\n` +
            `- Protein: ${t.minimumProteinFloor}g hard floor / ${t.targetProteinGrams}g target\n` +
            `- Serving: SINGLE serving (8–12 oz for smoothies / shakes) — ` +
            `NEVER pitcher, large-format, or double portions${appetiteNote}\n` +
            (glp1Ctx.compositionNote
              ? `- NOTE: ${glp1Ctx.compositionNote}\n`
              : "") +
            `These targets are patient-specific and take precedence over generic GLP-1 defaults above.\n`;
          console.log(
            `💊 [GLP-1/Beverage] Canonical targets injected: ` +
              `${t.resolvedSnackCalories}kcal / ${t.targetProteinGrams}g prot / ` +
              `${t.maximumToleratedFatGrams}g fat-ceiling ` +
              `[phase: ${t.treatmentPhase}] [sources: ${glp1Ctx.activationSources.join(",")}]`,
          );
        }
      } catch (err: any) {
        // Always re-throw: without confirmed GLP-1 status the generation must
        // not proceed unguarded — this includes resolver/DB failures.
        throw err;
      }
    }

    // ── Dish Adaptation Layer (Phase 5) ──────────────────────────────────────
    // For named drinks, anchor identity and cross-reference active guardrails so
    // "mojito + diabetic" adapts the mojito rather than replacing it. Only runs
    // when the user has requested a specific named drink.
    let _beverageDishDirective: DishAdaptationDirective | null = null;
    const _beverageIdentifier = (
      specificDrink?.trim() || (hasCustomDesc ? customBeverageDescription.trim() : "")
    ).trim();
    const _beverageIsNamed = !!_beverageIdentifier;
    if (_beverageIsNamed) {
      try {
        const _beverageGuardrailCtx = buildGuardrailContext({
          dietaryIdentity: beverageEnvelope.dietaryIdentity,
          glp1Active: !!beverageGlp1ResolvedTargets,
          allergies: beverageEnvelope.allergies,
          overriddenAllergens:
            _overriddenBeverageAllergens.length > 0 ? _overriddenBeverageAllergens : undefined,
        });
        _beverageDishDirective = await getDishAdaptationDirective(
          _beverageIdentifier,
          _beverageGuardrailCtx,
          "first_pass",
        );
        if (_beverageDishDirective) {
          console.log(
            `🍽️ [DAL/Beverage] Directive ready for "${_beverageIdentifier}" — ` +
            `${_beverageDishDirective.conflicts.length} guardrail conflict(s)`,
          );
        }
      } catch (dalErr) {
        console.warn("⚠️ [DAL/Beverage] Directive build failed — generation proceeds unenriched:", dalErr);
      }
    }

    // ── Adaptive Coaching Context (ACE) ────────────────────────────────────────
    // Injected AFTER all protocol/medical/behavioral blocks. Lowest priority tier.
    // Returns null when no check-in exists today → no-op, prompt unchanged.
    let aceBlock = "";
    if (userId && userId !== "1") {
      try {
        const aceResult = await buildAcePromptBlock(userId);
        if (aceResult) {
          aceBlock = `\n${aceResult.block}\n`;
          const { meta } = aceResult;
          console.log(
            `🧠 [ACE/Beverage] enabled | signals=${meta.signalCount} | intervention=${meta.interventionKey ?? "balanced"} | chars=${meta.charCount}`
          );
        }
      } catch (err) {
        console.warn("⚠️ [ACE/Beverage] Could not build coaching block — skipping:", err);
      }
    }

    const rawLang = (req as any).authUser?.preferredLanguage || "auto";
    const langInstruction = getLanguageInstruction(rawLang);
    const beverageLangPrefix = langInstruction ? `${langInstruction}\n\n` : "";
    const prompt = `${beverageLangPrefix}
You are a professional mixologist, nutritionist, and beverage chef inside the My Perfect Meals system.
Generate a FULL structured beverage recipe.
${beverageProtocolBlock ? `\n${beverageProtocolBlock}\n` : ""}${_beverageDishDirective ? `\n${_beverageDishDirective.adaptationBlock}\n` : ""}${medicalBeverageBlock}${glp1CanonicalBlock}${liquidNutritionBlock}${hydrationHandoffBlock}${cuisineOverrideBlock}${beverageBehavioralMemorySection ? `\n${beverageBehavioralMemorySection}\n` : ""}${dietCategoryStrategy.coachingBlock ? `\n${dietCategoryStrategy.coachingBlock}\n` : ""}${softOverrideBlock}${aceBlock}
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
${hasCustomDesc ? `- User's custom beverage idea: "${customBeverageDescription}" (this defines the drink concept and performance goals)
- Classified drink type: ${categoryLabel} — apply ALL ${categoryLabel}-specific rules below strictly
- 🚨 MANDATORY: Generate a ${categoryLabel} ONLY. This is a DRINK. Never return eggs, solid food, snacks, meals, or baked goods.${activeRestrictions.length > 0 ? `
- ⚠️ DIETARY IDENTITY CONSTRAINT (NON-NEGOTIABLE — takes precedence over macro targets above): All ingredients MUST comply with: ${dietaryRules}. Performance goals and macro targets are aspirational — adapt them to fit the dietary identity; do not violate the identity to hit a number. For example, a keto user's "carbs 40–80g" target means: achieve the best possible fueling with keto-compliant ingredients, not that keto rules are suspended.` : ""}` : `- Beverage CATEGORY: "${categoryLabel}" (this defines the drink type)
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
6. ${BEVERAGE_DIET_FIT_EXPLANATION_INSTRUCTION}
7. imageUrl should be a short descriptive image prompt (no quotes).
8. Apply all dietary requirements strictly.
9. When an explicit dietary identity is provided, include that identity as a clear leading descriptor in the beverage name, using the response language. Do not repeat it if it is already present.
${palateGuidance}

${getMeasurementPromptBlock((beverageMeasurementSystem) as MeasurementSystem)}
- Whole items: use "each" (e.g., "1 each lime", "2 each mint sprigs")
- Protein powder / supplement powder MUST use "scoop" or "scoops" — NEVER oz or grams (e.g., "1 scoop whey protein", "2 scoops vegan protein powder") ✅
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

    const titleDietRestrictions = [
      ...(typeof dietOverride === "string" ? [dietOverride] : []),
      ...(Array.isArray(dietaryPreferences)
        ? dietaryPreferences
        : [dietaryPreferences]),
      ...activeRestrictions,
    ];
    const knownProtocolName = getKnownBeverageProtocolName(
      beverageContext.builder,
      !!beverageGlp1ResolvedTargets,
    );

    async function generateValidatedAlternatives(
      rejection: BeverageProtocolRejection,
    ): Promise<any[]> {
      try {
        const alternativePrompt = buildBeverageAlternativePrompt({
          originalPrompt: prompt,
          requestedCategoryLabel,
          effectiveCategoryLabel: categoryLabel,
          flavorLabel,
          specificDrink: specificDrink?.trim() || undefined,
          customBeverageDescription: hasCustomDesc
            ? customBeverageDescription.trim()
            : undefined,
          rejection,
        });
        const completion = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: alternativePrompt }],
          response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
        const candidates = Array.isArray(parsed?.alternatives)
          ? parsed.alternatives
          : [];
        const alternatives: any[] = [];
        const seenNames = new Set<string>();
        const { validateMealForDiet } = beverageGlp1ResolvedTargets
          ? await import("../services/guardrails")
          : { validateMealForDiet: null };

        for (const candidate of candidates.slice(0, 3)) {
          if (
            !candidate ||
            typeof candidate.name !== "string" ||
            !candidate.name.trim() ||
            !Array.isArray(candidate.ingredients) ||
            candidate.ingredients.length === 0 ||
            typeof candidate.reasoning !== "string" ||
            !candidate.reasoning.trim() ||
            isSolidFood(candidate)
          ) {
            continue;
          }

          const candidateScan = scanGeneratedOutput(candidate, beverageEnvelope, {
            generatorName: "beverage_creator_alternative",
            skipAdaptableConflicts: dietAdaptOverride === true || userDietOverride === true,
            overriddenAllergens: _overriddenBeverageAllergens.length > 0
              ? _overriddenBeverageAllergens
              : undefined,
          });
          if (!candidateScan.passed) continue;

          if (activeRestrictions.includes("keto") && !userDietOverride) {
            const candidateCarbs = Number(candidate.nutrition?.carbs ?? 0);
            if (candidateCarbs > 15) continue;
          }

          const candidateMedicalValidation = validateBeverageOutput(
            candidate,
            beverageEnvelope,
            beverageContext.builder,
          );
          if (!candidateMedicalValidation.passed) continue;

          if (_beverageIsNamed) {
            const candidateIdentity = validateDishIdentity(
              _beverageIdentifier,
              candidate,
              _beverageDishDirective,
            );
            if (candidateIdentity.catastrophicDeviation) continue;
          }

          const normalizedCandidateIngredients = normalizeIngredients(
            candidate.ingredients,
          );
          if (beverageGlp1ResolvedTargets && validateMealForDiet) {
            const candidateNutrition = candidate.nutrition ?? {};
            const glp1Check = validateMealForDiet(
              {
                name: candidate.name,
                ingredients: normalizedCandidateIngredients.map((ingredient: any) => ({
                  name: String(ingredient.name ?? ""),
                })),
                macros: {
                  calories: Number(candidateNutrition.calories ?? 0),
                  protein: Number(candidateNutrition.protein ?? 0),
                  fat: Number(candidateNutrition.fat ?? 0),
                },
              },
              null,
              undefined,
              true,
              beverageGlp1ResolvedTargets,
            );
            if (!glp1Check.isValid) continue;
          }

          const normalizedName = String(
            ensureBeverageDietTitle(
              candidate.name,
              titleDietRestrictions,
              rawLang,
            ) ?? candidate.name,
          ).trim();
          const identity = normalizedName.trim().toLowerCase();
          if (seenNames.has(identity)) continue;
          seenNames.add(identity);
          alternatives.push({
            ...candidate,
            name: normalizedName,
            ingredients: normalizedCandidateIngredients,
            servingSize: candidate.servingSize || serving.label,
            imageUrl: null,
          });
          if (alternatives.length === 2) break;
        }

        console.log(
          `✅ [BEVERAGE] ${alternatives.length} validated alternative(s) available after ${rejection.error}`,
        );
        return alternatives;
      } catch (alternativeError) {
        console.error(
          "[BEVERAGE] Alternative generation failed; returning the protected rejection:",
          alternativeError,
        );
        return [];
      }
    }

    // Three attempts:
    //   Attempt 1 — normal generation
    //   Attempt 2 — appends specific protocol or clinical violation hint
    //   Attempt 3 — appends combined hint if still failing (last chance)
    const MAX_BEVERAGE_ATTEMPTS = 3;
    let meal: any;
    let beverageScan: ReturnType<typeof scanGeneratedOutput> | null = null;
    let beverageValidation: ReturnType<typeof validateBeverageOutput> | null = null;
    let finalRejection: BeverageProtocolRejection | null = null;

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
        overriddenAllergens: _overriddenBeverageAllergens.length > 0 ? _overriddenBeverageAllergens : undefined,
      });

      // ── Layer 2b: Keto carb-total gate ────────────────────────────────────
      // Ingredient-name scanning alone cannot catch a drink where every ingredient
      // is individually "allowed" but the total carbs are non-keto. After the
      // ingredient scan passes, verify the generated nutrition total.
      // Threshold: 15g carbs per serving — lenient enough for berries + coconut
      // but catches real violations like a 60g carb "keto" athletic drink.
      if (beverageScan?.passed && activeRestrictions.includes("keto") && !userDietOverride) {
        const generatedCarbs = Number(meal.nutrition?.carbs ?? 0);
        const KETO_BEVERAGE_CARB_CEILING = 15;
        if (generatedCarbs > KETO_BEVERAGE_CARB_CEILING) {
          const carbMsg = `Generated beverage has ${generatedCarbs}g carbs — exceeds the keto limit of ${KETO_BEVERAGE_CARB_CEILING}g per serving. Regenerate using lower-carb ingredients (avoid high-sugar fruit, coconut water in large amounts, sweetened bases).`;
          console.log(`🚫 [BEVERAGE] Keto carb ceiling exceeded (attempt ${attempt}): ${generatedCarbs}g carbs`);
          beverageScan = { passed: false, message: carbMsg, violations: [], instructionViolations: [] } as any;
        }
      }

      if (!beverageScan?.passed) {
        const failedScan = beverageScan ?? {
          passed: false,
          message: "The generated beverage could not be verified against your nutrition settings.",
        };
        console.log(`🚫 [BEVERAGE] Protocol violation (attempt ${attempt}): ${failedScan.message}`);
        beverageValidation = null;
        if (attempt >= MAX_BEVERAGE_ATTEMPTS) {
          finalRejection = {
            error: "PROTOCOL_VIOLATION",
            message: failedScan.message,
            retryable: true,
            rejectionKind: getBeverageRejectionKind(
              containsAlcoholContent(meal)
                ? [{ isAlcohol: true }]
                : undefined,
              "protocol",
            ),
            protocolName: knownProtocolName,
            violations: Array.isArray((failedScan as any).violations)
              ? (failedScan as any).violations.map((violation: any) =>
                  String(violation?.message ?? violation?.term ?? violation),
                )
              : undefined,
          };
          break;
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
          finalRejection = {
            error: "CLINICAL_VIOLATION",
            message:
              `This beverage cannot be generated safely for your health profile. ` +
              `Violations: ${beverageValidation.violations.map(v => v.rule).join("; ")}`,
            retryable: true,
            rejectionKind: getBeverageRejectionKind(
              beverageValidation.violations,
              "clinical",
            ),
            protocolName: knownProtocolName,
            violations: beverageValidation.violations.map((violation) => violation.rule),
          };
          break;
        }
        continue;
      }

      // All three layers passed — output is clean
      break;
    }

    if (finalRejection) {
      if (!shouldOfferBeverageAlternatives(process.env.NODE_ENV)) {
        return res.status(400).json({
          error: finalRejection.error,
          message: finalRejection.message,
          ...(finalRejection.violations && { violations: finalRejection.violations }),
          retryable: true,
        });
      }
      const alternatives = await generateValidatedAlternatives(finalRejection);
      return res.status(400).json({
        ...finalRejection,
        alternatives,
      });
    }

    // ── Dish Identity Validator (Phase 5) ─────────────────────────────────────
    // Only runs for named drinks. A catastrophic deviation (completely wrong
    // culinary result) is surfaced as an explicit error — never silent fallback.
    if (_beverageIsNamed && meal) {
      try {
        const identityResult = validateDishIdentity(_beverageIdentifier, meal, _beverageDishDirective);
        if (identityResult.catastrophicDeviation) {
          console.error(
            `🚫 [DishIdentity/Beverage] "${meal.name}" is not "${_beverageIdentifier}" — rejecting (score=${identityResult.score})`,
          );
          const conflictSummary = (_beverageDishDirective?.conflicts ?? [])
            .map(c => `${c.component} (${c.guardrail})`)
            .join(", ");
          return res.status(400).json({
            error: "DISH_IDENTITY_FAILURE",
            dishIdentityFailure: true,
            message:
              `We couldn't make "${_beverageIdentifier}" within your current constraints` +
              (conflictSummary ? ` — conflicts: ${conflictSummary}` : "") +
              `. Rather than serve you a different drink, we're being upfront: try adjusting your request or your safety settings.`,
            conflicts: _beverageDishDirective?.conflicts ?? [],
            retryable: true,
          });
        }
        console.log(
          `✅ [DishIdentity/Beverage] "${meal.name}" identity OK (score=${identityResult.score})`,
        );
      } catch (e) {
        console.warn("⚠️ [DishIdentity/Beverage] Validation error — proceeding:", e);
      }
    }

    const normalizedIngredients = normalizeIngredients(meal.ingredients || []);
    meal.ingredients = normalizedIngredients;
    const liquidValidation = validateLiquidNutritionOutput(meal, activeLiquidProtocol);
    if (liquidValidation.passed === false) {
      return res.status(400).json({
        error: "LIQUID_NUTRITION_CONFLICT",
        message: liquidValidation.message,
        retryable: true,
      });
    }

    const ingredientNames = normalizedIngredients.map((i: any) =>
      String(i.name ?? "").toLowerCase()
    );

    // ── GLP-1 post-generation macro validation ─────────────────────────────
    // Validates the final beverage against the patient's resolved fat ceiling,
    // calorie target, and protein floor. Prompt-level guidance alone is not
    // sufficient for clinical enforcement.
    // NOTE: the OpenAI response schema puts macros under meal.nutrition.* —
    // reading from meal.* directly always yields 0 because GPT puts them nested.
    if (beverageGlp1ResolvedTargets) {
      const { validateMealForDiet: _bevValidate } = await import("../services/guardrails");
      const mealNutrition = meal.nutrition ?? {};
      const bevGlp1Check = _bevValidate(
        {
          name: String(meal.name ?? ""),
          ingredients: normalizedIngredients.map((i: any) => ({ name: String(i.name ?? "") })),
          macros: {
            calories: Number(mealNutrition.calories ?? 0),
            protein: Number(mealNutrition.protein ?? 0),
            fat: Number(mealNutrition.fat ?? 0),
          },
        },
        null,
        undefined,
        true, // beverages are snack-equivalent for GLP-1 sizing
        beverageGlp1ResolvedTargets,
      );
      if (!bevGlp1Check.isValid) {
        console.error(
          `🚫 [BEVERAGE/GLP-1] Post-gen validation FAILED — ${bevGlp1Check.violations.join('; ')} | ` +
          `generated: ${meal.calories}kcal / ${meal.protein}g prot / ${meal.fat}g fat`
        );
        const finalGlp1Rejection: BeverageProtocolRejection = {
          error: "PROTOCOL_VIOLATION",
          message: `Generated beverage exceeds GLP-1 clinical limits: ${bevGlp1Check.violations[0]}. Please try again.`,
          violations: bevGlp1Check.violations,
          retryable: true,
          rejectionKind: getBeverageRejectionKind(undefined, "macro"),
          protocolName: "GLP-1",
        };
        if (!shouldOfferBeverageAlternatives(process.env.NODE_ENV)) {
          return res.status(400).json({
            error: finalGlp1Rejection.error,
            message: finalGlp1Rejection.message,
            violations: finalGlp1Rejection.violations,
            retryable: true,
          });
        }
        const alternatives = await generateValidatedAlternatives(finalGlp1Rejection);
        return res.status(400).json({
          ...finalGlp1Rejection,
          alternatives,
        });
      }
      console.log(
        `✅ [BEVERAGE/GLP-1] Post-gen PASSED — "${meal.name}" ` +
        `${meal.calories}kcal / ${meal.protein}g prot / ${meal.fat}g fat`
      );
    }

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
    const alphaGalBadge = computeAlphaGalBadge(
      `${(meal as any).name || ""} ${(meal as any).description || ""}`,
      ingredientNames,
      userConditions
    );

    // Generate image server-inline via canonical pipeline (caching + fallback handled internally)
    let imageUrl: string | null = null;
    try {
      imageUrl = await generateMealImageUnified(meal.name, ingredientNames, "beverage");
    } catch (imgErr) {
      console.warn("[BEVERAGE] Image generation failed:", imgErr);
    }

    // Creator System 2-pass transformation — applied after all safety checks and normalization.
    if (userId && userId !== "1") {
      const creatorSystem = await resolveCreatorSystemForUser(userId);
      meal = await applyCreatorTransformation(meal, creatorSystem, "beverage");
    }

    // Final response-only title guard. Explicit request values take precedence
    // over profile context so an override/selection is the identity shown.
    meal.name = ensureBeverageDietTitle(meal.name, titleDietRestrictions, rawLang);

    if (isDev) console.log("[BEVERAGE] Sending response (image handled client-side)...");

    // Phase 3B: emit usage event — beverage was generated
    if (userId && userId !== "1") {
      emitActivityEvent({
        ownerUserId: String(userId),
        eventType: "beverage_generated",
        eventClass: "usage",
        sourceFeature: "beverage_creator",
        metadata: { beverageCategory, flavorFamily, specificDrink },
      }).catch((err) => console.error("[ActivityEvents]", err.message));
    }

    const { complianceSection: bevCompliance, dietClassification: bevDietClass } =
      buildMealComplianceBundle(meal, beverageEnvelope, { isChefAdapted: dietAdapted });
    return res.json({
      ...meal,
      imageUrl,
      medicalBadges,
      ...(alphaGalBadge && { alphaGalBadge }),
      ...(dietAdapted && { dietAdapted: true, dietNotice }),
      complianceSection: bevCompliance,
      dietClassification: bevDietClass,
      consideredForYou: buildHydrationConsideredForYou({
        envelope: beverageEnvelope,
        builder: beverageContext.builder,
        liquidProtocol: activeLiquidProtocol,
        glp1Active: beverageGlp1Active,
      }),
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
