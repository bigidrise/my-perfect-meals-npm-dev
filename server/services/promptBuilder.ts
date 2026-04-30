// server/services/promptBuilder.ts
import { MealGenerationRequest, UserOnboardingProfile } from "./mealEngineService";
import { UnitPrefs } from "./validators";
import { getBaselineMacroPrompt } from "./guardrails/promptPolicyGate";
import { AVOIDANCE_EXPANSION } from "./allergyGuardrails";

/** Expand avoidIngredients category labels into full ingredient lists for AI prompts. */
function expandAvoidIngredients(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const out = new Set<string>();
  for (const item of raw) {
    const key = item.trim().toLowerCase();
    const expanded = AVOIDANCE_EXPANSION[key];
    if (expanded) {
      out.add(key);
      expanded.forEach(t => out.add(t));
    } else {
      out.add(key);
    }
  }
  return Array.from(out);
}

// ─── VEGETABLE STRATEGY SYSTEM ───────────────────────────────────────────────

export interface NutritionStrategyContext {
  cutIntensity?: string;        // "standard" | "hard"
  cutStyle?: string;            // "balanced" | "lowCarb"
  cycleMode?: string;           // "none" | "carbCycle" | "fatCycle"
  cycleDayType?: string;        // "low" | "moderate" | "high"
  starchyCarbs_g?: number;
  fibrousCarbs_g?: number;
  mealsPerDay?: number;
  vegetableCupsPerMeal?: number;
  vegetableCupsPerDay?: number;
  strictMode?: boolean;
}

/**
 * Converts the user's active nutrition strategy into hard meal-generation rules.
 * Injected into the system prompt for every builder that should obey macro strategy.
 *
 * Rules:
 *   - On zero-starch days: block all starchy sources, maximise vegetable volume
 *   - On low-starch days: replace starches with high-volume vegetable substitutes
 *   - On moderate/standard days: allow starch, still hit minimum vegetable cups
 *   - NEVER reject the user's request — translate it into the compliant version
 */
export function buildVegetableStrategyPrompt(ctx: NutritionStrategyContext): string {
  if (!ctx || (!ctx.cutIntensity && !ctx.cycleMode && !ctx.starchyCarbs_g && !ctx.fibrousCarbs_g)) {
    return ''; // No strategy set — legacy behaviour, don't inject anything
  }

  const cupsPerMeal = ctx.vegetableCupsPerMeal ?? 3;
  const cupsPerDay  = ctx.vegetableCupsPerDay ?? ((ctx.mealsPerDay ?? 3) * cupsPerMeal);
  const starchyG    = ctx.starchyCarbs_g ?? null;
  const fibrousG    = ctx.fibrousCarbs_g ?? null;

  // Determine starch condition
  const isZeroStarch   = starchyG !== null && starchyG === 0;
  const isLowStarch    = !isZeroStarch && (
    ctx.cycleMode === 'carbCycle' && ctx.cycleDayType === 'low' ||
    ctx.cutIntensity === 'hard' && ctx.cutStyle === 'lowCarb' ||
    (starchyG !== null && starchyG < 30)
  );
  const isModerateStarch = !isZeroStarch && !isLowStarch && (
    ctx.cutIntensity === 'hard' ||
    ctx.cycleMode === 'carbCycle' && ctx.cycleDayType === 'moderate'
  );

  // Vegetable substitution lists
  const HIGH_VOL_VEGS = 'broccoli, cauliflower, zucchini, spinach, kale, asparagus, green beans, peppers, mushrooms, cabbage, celery, Brussels sprouts, cucumber, mixed greens, lettuce';
  const STARCH_SUBS   = 'cauliflower rice (for rice), cauliflower mash (for potatoes), zucchini noodles (for pasta), spaghetti squash (for pasta), shredded cabbage (for grain bowls), lettuce wraps (for tortillas/bread)';
  const STARCH_SOURCES = 'rice, white potatoes, pasta, bread, tortillas, oats, corn, crackers, rolls, noodles, beans as primary carb source';

  if (isZeroStarch) {
    return `
🥦 NUTRITION STRATEGY — ZERO STARCH DAY (MANDATORY GUARDRAILS):
This user is on a zero-starch day. Their fibrous carb target is ${fibrousG ?? 'high'}g from vegetables.

VEGETABLE REQUIREMENT: ${cupsPerMeal} cups per meal (${cupsPerDay} cups/day total).
- 1 cup vegetables ≈ 5g fibrous carbs.

HARD RULES:
1. DO NOT include ANY starchy carb sources in the final meal: ${STARCH_SOURCES}.
2. If the user requested a starchy food, translate it into the closest compliant version using: ${STARCH_SUBS}.
3. Volume, satiety, and realism MUST be preserved — the meal should feel complete and satisfying.
4. Increase vegetable variety and portion to compensate for removed starch.
5. Prioritise high-volume, low-energy vegetables: ${HIGH_VOL_VEGS}.
6. Protein and fat remain unchanged from user targets.
7. In your JSON response, populate the "substitutionNotes" array with 1-sentence explanations for each substitution (e.g. "Rice was replaced with cauliflower rice to match your zero-starch plan."). Do NOT mention AI or prompts — keep it human and coach-like.
`.trim();
  }

  if (isLowStarch) {
    return `
🥦 NUTRITION STRATEGY — LOW STARCH DAY (MANDATORY GUARDRAILS):
This user is on a low-starch day. Starchy carbs are restricted to ${starchyG ?? 'minimal'}g. Fibrous carb target is ${fibrousG ?? 'elevated'}g from vegetables.

VEGETABLE REQUIREMENT: ${cupsPerMeal} cups per meal (${cupsPerDay} cups/day total).

HARD RULES:
1. Reduce starch portions significantly. Use smaller amounts of starchy ingredients OR substitute them.
2. Preferred substitutes for starches: ${STARCH_SUBS}.
3. Fill volume with high-volume vegetables: ${HIGH_VOL_VEGS}.
4. If the user requested a starchy meal, generate the closest low-starch compliant version.
5. Meal must still feel satisfying — use protein presence, vegetable variety, and sauces/seasonings.
6. In your JSON response, populate the "substitutionNotes" array with 1-sentence explanations for each substitution made (e.g. "Pasta portion was reduced and replaced with zucchini noodles to match your low-starch plan."). Do NOT mention AI or prompts — keep it human and coach-like.
`.trim();
  }

  if (isModerateStarch) {
    return `
🥦 NUTRITION STRATEGY — MODERATE STARCH DAY:
This user is on a moderate-starch plan. Starchy carbs are available but reduced. Fibrous carb target is ${fibrousG ?? 'elevated'}g.

VEGETABLE REQUIREMENT: ${cupsPerMeal} cups per meal (${cupsPerDay} cups/day total).

GUIDELINES:
1. Use moderate starch portions (smaller serving than usual).
2. Pair starch with extra vegetables to meet volume target.
3. Prioritise lean protein + vegetables as the base; starch is a side, not the foundation.
`.trim();
  }

  // Standard day — no restrictions, just remind to include vegetables
  return `
🥦 NUTRITION STRATEGY — STANDARD DAY:
Vegetable target: ${cupsPerMeal} cups per meal (${cupsPerDay} cups/day total).
Include a generous vegetable component in every meal. High-volume options: ${HIGH_VOL_VEGS}.
`.trim();
}

export interface PalatePreferences {
  palateSpiceTolerance?: "none" | "mild" | "medium" | "hot";
  palateSeasoningIntensity?: "light" | "balanced" | "bold";
  palateFlavorStyle?: "classic" | "herb" | "savory" | "bright";
  // Onboarding-sourced preferences (override palate* fields when present)
  flavorPreference?: string | null;  // bold-spicy, bold-flavorful, comfort, mediterranean, balanced, unsure
  heatPreference?: string | null;    // none, mild, medium, hot, very-hot, unsure
  medicalConditions?: string[];      // used to cap heat when clinical context demands it
  // Cuisine Identity
  cuisinePreference?: string | null;
  cuisineIntensity?: "light" | "balanced" | "authentic" | null;
}

// Medical conditions that require heat to be capped at mild regardless of user preference
const HEAT_SENSITIVE_CONDITIONS = [
  "diabetes-type1", "diabetes-type2", "prediabetes",
  "crohns", "ulcerative-colitis", "ibs",
  "anti-inflammatory", "rheumatoid-arthritis", "psoriasis", "lupus",
];

function effectiveHeat(
  heatPreference: string | null | undefined,
  medicalConditions: string[] | undefined,
): string {
  const requested = heatPreference || "mild";
  const isSensitive = medicalConditions?.some(c => HEAT_SENSITIVE_CONDITIONS.includes(c));

  if (!isSensitive) return requested;

  // Cap heat at mild for clinical conditions
  const heatRank: Record<string, number> = { none: 0, mild: 1, medium: 2, hot: 3, "very-hot": 4, unsure: 1 };
  const requestedRank = heatRank[requested] ?? 1;
  return requestedRank > 1 ? "mild" : requested;
}

export function buildPalateSection(profile: PalatePreferences): string {
  // If onboarding fields are present, they take priority over the old palate* fields
  const hasOnboardingPrefs = profile.flavorPreference || profile.heatPreference;

  if (hasOnboardingPrefs) {
    const heat = effectiveHeat(profile.heatPreference, profile.medicalConditions);
    const flavor = profile.flavorPreference || "balanced";

    const heatMap: Record<string, string> = {
      none: "NO heat or spice — no chili, hot sauce, cayenne, jalapeño, or any burning heat; flavor through herbs, garlic, and seasoning only",
      mild: "mild warmth only — light black pepper or a pinch of paprika acceptable, no burn",
      medium: "noticeable heat welcome — cumin, paprika, mild chilies, light sriracha acceptable",
      hot: "clear spice presence — jalapeños, chili flakes, hot sauce, gochujang encouraged",
      "very-hot": "strong spice-forward — ghost pepper, habanero, heavy hot sauce, aggressive heat encouraged",
      unsure: "moderate seasoning — not bland, not spicy; aim for broad appeal",
    };

    const flavorMap: Record<string, string> = {
      "bold-spicy": "bold, richly seasoned flavors — smoky, savory, deeply seasoned",
      "bold-flavorful": "bold, richly seasoned flavors — smoky, savory, deeply seasoned",
      comfort: "comfort-style — hearty, familiar, cozy preparations",
      mediterranean: "Mediterranean-inspired — olive oil, fresh herbs, lemon, tomatoes, garlic",
      balanced: "balanced, well-rounded flavors — appealing without being overpowering",
      unsure: "balanced, well-rounded flavors",
    };

    const heatInstruction = heatMap[heat] || heatMap["unsure"];
    const flavorInstruction = flavorMap[flavor] || flavorMap["balanced"];
    const clinicalNote = profile.medicalConditions?.some(c => HEAT_SENSITIVE_CONDITIONS.includes(c)) && heat !== (profile.heatPreference || "mild")
      ? " (heat moderated for clinical dietary requirements)"
      : "";

    return `Flavor preferences: ${flavorInstruction}. Heat level: ${heatInstruction}${clinicalNote}.`;
  }

  // Legacy palate* field path
  const spice = profile.palateSpiceTolerance || "mild";
  const seasoning = profile.palateSeasoningIntensity || "balanced";
  const flavor = profile.palateFlavorStyle || "classic";

  const spiceMap: Record<string, string> = {
    none: "NO spicy ingredients - no chili, hot sauce, cayenne, jalapeno, or any heat",
    mild: "mild spice only - light black pepper, minimal heat",
    medium: "moderate spice welcome - can use cumin, paprika, mild chilies",
    hot: "spicy foods preferred - include bold heat, chilies, hot sauce when appropriate",
  };

  const seasoningMap: Record<string, string> = {
    light: "light seasoning - subtle flavors, minimal salt/spices",
    balanced: "balanced seasoning - well-seasoned but not overpowering",
    bold: "bold seasoning - rich, pronounced flavors, generous herbs/spices",
  };

  const flavorMap: Record<string, string> = {
    classic: "classic comfort flavors - traditional preparations",
    herb: "herb-forward - fresh herbs like basil, cilantro, parsley, dill",
    savory: "savory umami-rich - garlic, soy, mushroom, roasted notes",
    bright: "bright & fresh - citrus, vinegar, fresh vegetables, zesty",
  };

  return `Flavor preferences: ${spiceMap[spice]}. ${seasoningMap[seasoning]}. ${flavorMap[flavor]}.`;
}

export function buildMealPrompt(
  profile: UserOnboardingProfile,
  req: MealGenerationRequest,
  unitPrefs: UnitPrefs
): { system: string; user: string } {
  // Handle diet hierarchy: medical override > temporary preference > profile default > balanced
  const diet = req.tempMedicalOverride ?? req.tempDietPreference ?? req.tempDietOverride ?? profile.dietType ?? "balanced";
  const servings = req.servings ?? 1;

  const medical: string[] = [];
  if (profile.hasDiabetesType1 || profile.hasDiabetesType2) {
    medical.push(
      "Diabetes: prioritize low/medium glycemic carbs, pair carbs with protein/fiber, avoid sugary sauces/juices, avoid dessert-like breakfasts."
    );
  }

  const expandedAvoidIngredients = expandAvoidIngredients(profile.avoidIngredients);
  const avoid = Array.from(new Set([...(profile.allergies ?? []), ...expandedAvoidIngredients]));
  const bannedSweeteners = profile.bannedSweeteners?.length ? `Banned sweeteners: ${profile.bannedSweeteners.join(", ")}.` : "";

  const mediterraneanRules = diet.toLowerCase().includes('mediterranean') ? `

MEDITERRANEAN DIET PRINCIPLES (MANDATORY):
- Use olive oil as primary cooking fat and dressing base
- Include fresh herbs: oregano, basil, thyme, rosemary, parsley
- Prefer fish and seafood over red meat
- Use tomatoes, olives, garlic, and lemon frequently
- Include nuts, seeds, and legumes
- Choose whole grains over refined
- Fresh vegetables and fruits in abundance
- Limited red meat and processed foods
- Cooking methods: grilling, roasting, sautéing with olive oil` : '';

  const liverSupportRules = diet === 'liver-support' ? `

LIVER SUPPORT CLINICAL GUARDRAILS (MANDATORY):
- No alcohol of any kind (beer, wine, liquor, cocktails)
- No deep fried foods (fried chicken, french fries, fried anything)
- No high added sugar (candy, donuts, pastries, heavy syrup, soda, sweet tea, energy drinks, juice cocktails)
- No ultra-processed foods (fast food, instant noodles, processed junk)
- Avoid processed meats (bacon, sausage, hot dogs, deli meat)
- Avoid heavy butter/cream-based dishes
- Avoid high sodium foods (jerky, heavily salted items, ramen)
- Prioritize leafy greens: spinach, kale, arugula
- Prioritize cruciferous vegetables: broccoli, cauliflower, brussels sprouts
- Prioritize omega-3 rich foods: salmon, sardines, tuna, chia, flax, walnuts
- Prioritize legumes and whole grains: beans, lentils, oats, quinoa, brown rice
- Use olive oil and avocado as primary fat sources
- These guardrails apply to meal composition only. Do NOT override the user's macro targets.` : '';

  const sys = `
You are a meticulous nutrition chef AI. Your job is to generate SAFE, PRECISE, REALISTIC meals that strictly obey user rules.

ABSOLUTE RULES:
- Respect ALLERGIES and AVOIDS with zero exceptions.
- If user has diabetes (T1 or T2), use low/medium GI carbs, balance carbs with protein/fiber, avoid added sugars.
- Respect diet type (${diet}) and ingredient bans.
- Use straightforward, kitchen-ready instructions only. No fluff, no tips, no equipment essays.${mediterraneanRules}${liverSupportRules}

${getBaselineMacroPrompt({ dietType: diet, mealType: req.mealType })}

🚨 MEAL TYPE APPROPRIATENESS RULES (CRITICAL - NEVER VIOLATE):
- BREAKFAST: Appropriate foods include eggs, oatmeal, toast, pancakes, yogurt, smoothies, cereal, fruit bowls, breakfast sandwiches. NEVER assign heavy dinner foods like steak, casseroles, or pasta dishes to breakfast.
- LUNCH: Appropriate foods include sandwiches, salads, soups, wraps, grain bowls, light pasta dishes, burgers, lighter proteins.
- DINNER: Appropriate foods include hearty proteins (steak, chicken thighs, salmon), pasta dishes, casseroles, stir-fries, roasts, full entrees. NEVER assign breakfast items like parfait, yogurt bowls, smoothies, or cereal to dinner.
- SNACK: Appropriate foods include nuts, fruits, crackers, small portions, energy bites, veggie sticks with dip. NEVER assign full meals to snack time.
⚠️ CUISINE EXCEPTION — MEAL TYPE IS CUISINE-CONDITIONAL: When a cuisine preference is specified, the above Western examples are NOT universal defaults. Do NOT apply Western breakfast/lunch/dinner templates to non-Western cuisines. Many cultures eat rice, soup, grilled meat, or porridge for breakfast; noodle dishes for any meal; or have no concept of "breakfast food." When a cuisine is set, defer to that cuisine's actual meal patterns — not the Western examples listed above.
🚨 EXAMPLES OF INCORRECT ASSIGNMENTS TO AVOID:
- "Nutty Fruit Parfait" as DINNER (this is a breakfast/snack item)
- "Greek Yogurt Bowl" as DINNER (this is breakfast)
- "Smoothie Bowl" as DINNER (this is breakfast)
- "Steak and Potatoes" as BREAKFAST (this is dinner)
- "Heavy Casserole" as BREAKFAST (this is dinner)
- "Steak and Potatoes" as BREAKFAST (this is dinner)
- "Heavy Casserole" as BREAKFAST (this is dinner)
${(req as any).cravingInput ? `
🔥 CRITICAL USER REQUEST: User specifically requested "${(req as any).cravingInput}". You MUST create this exact dish/recipe. Do NOT substitute with a different meal. This is their explicit request - honor it precisely.` : ""}

OUTPUT FORMAT: a single JSON object with keys:
{
  "name": string,
  "description": string,
  "ingredients": [{"name": string, "amount": string, "unit": string, "preparationNote": string?}, ...],
  "instructions": [string, ...], // actionable steps only
  "nutrition": {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "sugar_g": number},
  "servings": number
}

🚨 U.S. MEASUREMENT RULES (CRITICAL - EXACT MEASUREMENTS REQUIRED):
- Use ONLY these units: oz, lb, cup, tbsp, tsp, each (for eggs only), fl oz
- NEVER use grams (g), milliliters (ml), or metric units
- NEVER use "piece" or "pieces" for meats/proteins - always use oz or lb
- Proteins (chicken, beef, fish, pork) MUST be measured in oz (4-8 oz typical serving)
- DEFAULT LEAN CUT RULE: When beef, steak, lamb, or pork is included and no specific cut is named, always default to a lean cut — rotate through: sirloin, tenderloin, eye of round, flank steak, or filet mignon (vary the cut, do not always pick the same one). Red meat portion defaults to 4–6 oz. Only use a fatty cut (ribeye, T-bone, porterhouse, brisket) if the user explicitly names it. Naming a cut overrides the cut choice only — portion still defaults to 4–6 oz unless the user also specifies a different amount.
- Dairy (yogurt, cheese, milk) use oz or cups
- Liquids use cup, tbsp, tsp, or fl oz
- ALWAYS provide EXACT numeric measurements - never use "a pinch", "dash", "to taste"
- Use precise amounts like 6 oz, 1/2 cup, 2 tbsp - no vague measurements
- For small amounts, use fractions: 1/4 tsp, 1/2 cup
- Scale output for the requested servings exactly (${servings})
- Every ingredient MUST have a specific amount and unit
- DO NOT include macro/nutrition data in ingredient rows - macros go in the nutrition object only

EXAMPLES OF CORRECT INGREDIENT FORMAT:
- {"name": "chicken breast", "amount": "6", "unit": "oz", "preparationNote": "boneless, skinless"}
- {"name": "Greek yogurt", "amount": "1", "unit": "cup"}
- {"name": "olive oil", "amount": "2", "unit": "tbsp"}
- {"name": "eggs", "amount": "2", "unit": "each", "preparationNote": "scrambled"}
- {"name": "broccoli florets", "amount": "2", "unit": "cup", "preparationNote": "steamed"}
- {"name": "mixed greens", "amount": "3", "unit": "cup"}
- {"name": "bell pepper", "amount": "1", "unit": "cup", "preparationNote": "diced"}
- {"name": "zucchini", "amount": "1.5", "unit": "cup", "preparationNote": "sliced"}
- {"name": "asparagus", "amount": "8", "unit": "oz", "preparationNote": "trimmed"}
- {"name": "spinach", "amount": "2", "unit": "cup", "preparationNote": "fresh"}

EXAMPLES OF INCORRECT FORMAT (NEVER DO THIS):
- {"name": "chicken", "amount": "1", "unit": "piece"} ❌ (use oz instead)
- {"name": "yogurt", "amount": "340", "unit": "g"} ❌ (use cups instead)
- {"name": "chicken", "amount": "150", "unit": "g", "protein": 30} ❌ (no grams, no macros)
- {"name": "broccoli", "amount": "100", "unit": "g"} ❌ (use cups instead)
- {"name": "spinach", "amount": "50", "unit": "grams"} ❌ (use cups instead)

DO NOT:
- Do not include banned ingredients or sweeteners.
- Do not use vague steps like "cook until done." Be specific with times/temps.
- Do not use vague measurements like "a pinch", "to taste", "handful", "dash".
- Do not output anything except the JSON object.
- Do not omit measurement amounts - every ingredient needs exact quantities.
  `.trim();

  const palateSection = buildPalateSection(profile);

  const user = `
User: ${profile.name ?? profile.userId}
Diet: ${diet}
Calories/day target: ${profile.caloriesPerDay ?? "unknown"}
Protein target/day: ${profile.proteinTargetG ?? "unknown"} g
Medical: ${medical.join(" ")}
Allergies: ${avoid.length ? avoid.join(", ") : "none"}
Avoid ingredients: ${expandedAvoidIngredients.length ? expandedAvoidIngredients.join(", ") : "none"}
Sweeteners: allow ${profile.preferredSweeteners?.join(", ") || "standard options"}; ${bannedSweeteners}
Body type: ${profile.bodyType ?? "n/a"}
${palateSection}

Source: ${req.source}
Meal type: ${req.mealType || "any meal"}
${req.source === "craving" && (req as any).cravingInput ? `SPECIFIC CRAVING REQUEST: "${(req as any).cravingInput}" - Create this exact dish/meal the user is craving.` : ""}
Selected ingredients (must use if present): ${req.selectedIngredients?.length ? req.selectedIngredients.join(", ") : "none"}
Fridge items (available, prefer to use): ${req.fridgeItems?.length ? req.fridgeItems.join(", ") : "none"}
Servings: ${servings}

Generate ONE ${req.mealType || "meal"} obeying all rules. ${req.source === "craving" && (req as any).cravingInput ? `🔥 MANDATORY: Create "${(req as any).cravingInput}" exactly as requested. This is their specific craving - do not substitute with any other dish.` : `🚨 CRITICAL: Ensure the meal is appropriate for ${req.mealType || "the meal type"}. Choose ingredients that fit both the meal timing AND the diet+medical constraints. Never assign breakfast items to dinner or dinner items to breakfast.`} Provide full nutrition estimates.
  `.trim();

  return { system: sys, user };
}

/**
 * Keep It Simple mode — injected AFTER all diet/medical guardrails so it takes final precedence.
 * When enabled, the AI is forbidden from adding any ingredient not explicitly listed by the user.
 */
export function buildStrictModeBlock(ingredientHint?: string): string {
  return `
🚫 KEEP IT SIMPLE MODE (HARD CONSTRAINT — HIGHEST PRIORITY)
This rule overrides all other instructions about creativity or enhancement.
- Use ONLY the ingredients explicitly requested by the user${ingredientHint ? ` (${ingredientHint})` : ""}.
- Do NOT add any new ingredients whatsoever.
- Do NOT add pantry staples (oil, salt, pepper, butter, water, sauces, spices) unless explicitly listed.
- Do NOT add garnish, toppings, optional extras, substitutions, or "chef upgrades".
- Do NOT "enhance" or "optimize" the ingredient list in any way.
- If an ingredient is not in the user's request, it does not exist.
The output MUST contain only the user-provided ingredients. No exceptions.
`.trim();
}