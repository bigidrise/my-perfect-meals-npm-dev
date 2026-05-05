/**
 * Beverage Medical Rules — Single Source of Truth
 *
 * This module drives three capabilities from one registry:
 *
 *   1. PROMPT INJECTION  — buildBeveragePromptBlocks() injects explicit
 *      ingredient-level ban/require text before generation.
 *
 *   2. POST-GEN VALIDATION — validateBeverageOutput() scans returned
 *      ingredients against the same ban lists with false-positive protection.
 *
 *   3. AUTO-FIX — attemptBeverageAutoFix() performs surgical ingredient
 *      swaps for simple violations before burning an OpenAI retry call.
 *
 * Precision matching rules:
 *   - bannedKeywords: substring match (catches "ripe banana" via "banana")
 *   - safeVariants: if the text also contains a safe phrase, the ban is skipped
 *     ("non-alcoholic wine" contains "wine" but is NOT alcoholic)
 *   - Alcohol violations never auto-fix — the full drink concept must change
 *
 * Adding a new condition: add one entry to BEVERAGE_CONDITION_RULES, update
 * detectActiveBeverageConditions() — no other files need changing.
 */

import type { UserProtocolEnvelope } from "../protocolEnvelope";
import type { BuilderKey } from "../nutritionContext/getActiveNutritionContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BeverageConditionFamily =
  | "cardiac"
  | "renal"
  | "liver-disease"
  | "liver-support"
  | "oncology"
  | "diabetic"
  | "glp1"
  | "anti-inflammatory";

export interface BeverageRuleSet {
  label: string;
  /**
   * Substring keywords matched against ingredient.name, meal.name, description.
   * A match triggers a hard fail UNLESS the matched text also contains a
   * corresponding entry from safeVariants (false-positive protection).
   */
  bannedKeywords: string[];
  /**
   * Per-keyword safe phrases that override the ban.
   * Example: keyword "wine" → safeVariants ["wine vinegar", "non-alcoholic wine"]
   * If the matched text includes ANY safe phrase, the ban is skipped.
   */
  safeVariants?: Record<string, string[]>;
  calorieCap: number | null;
  prompt: {
    icon: string;
    title: string;
    ban: string;
    required: string;
  };
}

export interface BeverageViolation {
  condition: string;
  /** The full ingredient string that matched */
  ingredient: string;
  rule: string;
  correction: string;
  /** The exact keyword that fired — used by auto-fix for swap lookup */
  keyword: string;
  /** True when this violation involves an alcohol ingredient (blocks auto-fix) */
  isAlcohol: boolean;
}

export interface BeverageValidationResult {
  passed: boolean;
  violations: BeverageViolation[];
  retryHint: string;
}

export interface BeverageAutoFixResult {
  fixes: Array<{ keyword: string; replacement: string; affectedText: string }>;
  note: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared ban lists
// ─────────────────────────────────────────────────────────────────────────────

const ALCOHOL_KEYWORDS: string[] = [
  "vodka", "rum", "gin", "tequila", "whiskey", "whisky", "bourbon",
  "wine", "beer", "champagne", "prosecco", "liqueur", "kahlúa", "kahlua",
  "amaretto", "baileys", "triple sec", "cointreau", "cognac", "brandy",
  "sake", "mead", "schnapps", "creme de", "midori", "aperol", "campari",
  "vermouth", "absinthe", "alcohol", "soju", "shochu", "hard seltzer",
  "white claw", "hard cider", "hard kombucha", "wine cooler", "hard lemonade",
];

/** Phrases that override an alcohol keyword match (false-positive protection) */
const ALCOHOL_SAFE_VARIANTS: Record<string, string[]> = {
  alcohol:    ["alcohol-free", "non-alcoholic", "dealcoholized", "0% abv", "zero alcohol"],
  wine:       ["wine vinegar", "rice wine vinegar", "non-alcoholic wine", "dealcoholized wine"],
  beer:       ["root beer", "ginger beer", "non-alcoholic beer", "craft root beer"],
  sake:       ["sake vinegar", "non-alcoholic sake"],
  rum:        ["rum extract flavor", "rum flavoring"],  // small flavor amounts only
  champagne:  ["champagne vinegar", "non-alcoholic champagne"],
  "hard cider": ["non-alcoholic cider", "apple cider" ],
};

/** Set for O(1) lookup — used in violation isAlcohol tagging */
const ALCOHOL_KEYWORD_SET = new Set(ALCOHOL_KEYWORDS.map(k => k.toLowerCase()));

const RAW_SEAFOOD_KEYWORDS: string[] = [
  "raw oyster", "raw oysters", "raw clam", "raw clams",
  "raw shellfish", "raw fish", "raw sushi", "raw sashimi",
];

// ─────────────────────────────────────────────────────────────────────────────
// Auto-fix swap table — keyword → replacement ingredient name
//
// Only simple 1:1 ingredient swaps are listed here. Alcohol violations are
// intentionally absent — those require full recipe reconstruction, not a swap.
// ─────────────────────────────────────────────────────────────────────────────

const INGREDIENT_AUTO_FIXES: Record<string, string> = {
  // ── Cardiac swaps ───────────────────────────────────────────────────────────
  "ice cream":               "frozen banana and oat milk",
  "whole milk":              "oat milk",
  "heavy cream":             "unsweetened oat milk",
  "half and half":           "oat milk",
  "butter":                  "none (omit — not needed in this beverage)",
  "coconut cream":           "light coconut milk",
  "cream cheese":            "plain low-fat Greek yogurt",
  "whipped cream":           "none (omit)",
  "simple syrup":            "½ tsp raw honey or stevia drops",
  "condensed milk":          "unsweetened almond milk",
  "sweetened condensed milk": "unsweetened almond milk",

  // ── Renal swaps ─────────────────────────────────────────────────────────────
  "banana":                  "blueberries",
  "plantain":                "green apple",
  "orange juice":            "unsweetened cranberry juice",
  "citrus juice":            "unsweetened cranberry juice",
  "citrus blend":            "unsweetened cranberry juice",
  "tomato juice":            "cucumber water",
  "tomato":                  "cucumber",
  "avocado":                 "plain low-fat Greek yogurt",
  "chocolate":               "carob powder",
  "cocoa powder":            "carob powder",
  "cocoa":                   "carob powder",
  "cacao powder":            "carob powder",
  "cacao":                   "carob powder",
  "peanut butter":           "sunflower seed butter",
  "nut butter":              "sunflower seed butter",
  "cola":                    "sparkling water",
  "coca-cola":               "sparkling water",
  "pepsi":                   "sparkling water",
  "dark soda":               "sparkling water with lemon",
  "energy drink":            "unsweetened green tea",
  "red bull":                "unsweetened green tea",
  "monster energy":          "unsweetened green tea",
  "bang energy":             "unsweetened green tea",

  // ── Diabetic swaps ──────────────────────────────────────────────────────────
  "corn syrup":                  "stevia syrup",
  "high fructose corn syrup":    "stevia syrup",
};

// ─────────────────────────────────────────────────────────────────────────────
// Rule registry — one entry per condition family
// ─────────────────────────────────────────────────────────────────────────────

export const BEVERAGE_CONDITION_RULES: Record<BeverageConditionFamily, BeverageRuleSet> = {

  // ── CARDIAC / HEART DISEASE / HYPERTENSION ─────────────────────────────────
  cardiac: {
    label: "Cardiac / Heart Disease",
    bannedKeywords: [
      "ice cream", "whole milk", "heavy cream", "butter", "coconut cream",
      "cream cheese", "whipped cream", "half and half",
      "simple syrup", "condensed milk", "sweetened condensed milk",
      ...ALCOHOL_KEYWORDS,
    ],
    safeVariants: ALCOHOL_SAFE_VARIANTS,
    calorieCap: 200,
    prompt: {
      icon: "🫀",
      title: "CARDIAC BEVERAGE SAFETY — MANDATORY (clinically required, cannot be overridden)",
      ban: "full-fat ice cream or frozen dairy desserts even as a blending base (use frozen banana, low-fat yogurt, or sorbet); whole milk or heavy cream (use oat milk, almond milk, soy milk, or low-fat milk); butter or coconut cream; added sugar > 1 tsp, simple syrup, honey > 1 tsp, sweetened condensed milk, flavored syrups; alcohol of any kind; high-sodium ingredients (soy sauce, salted broths)",
      required: "≤ 200 calories/serving; base = plant milk, low-fat milk, plain low-fat yogurt, water, coconut water, or unsweetened tea; natural fruit sweetness preferred; cultural flavor identity preserved — change base and sweetener only, not the drink concept. If a milkshake is requested: frozen banana + plant milk + cultural flavoring. NEVER full-fat ice cream.",
    },
  },

  // ── RENAL / KIDNEY DISEASE / CKD ───────────────────────────────────────────
  renal: {
    label: "Renal / Kidney Disease",
    bannedKeywords: [
      // High-potassium (including common synonym forms)
      "banana", "plantain",
      "orange juice", "citrus juice", "citrus blend",
      "tomato juice", "tomato",
      "avocado",
      // High-phosphorus
      "chocolate", "cocoa powder", "cocoa", "cacao powder", "cacao",
      "peanut butter", "nut butter",
      // High-phosphorus sodas
      "cola", "coca-cola", "pepsi", "dark soda",
      // Energy drinks
      "energy drink", "red bull", "monster energy", "bang energy",
    ],
    safeVariants: {
      cocoa: ["cocoa butter"],    // cocoa butter has negligible phosphorus
      cacao: ["cacao butter"],
    },
    calorieCap: 200,
    prompt: {
      icon: "🫘",
      title: "RENAL / KIDNEY DISEASE BEVERAGE SAFETY — MANDATORY (clinically required)",
      ban: "high-potassium ingredients — banana, plantain, orange, orange juice, citrus juice, tomato juice, avocado, spinach-dominant juices, potato-based drinks; high-phosphorus — nuts, seeds, chocolate, cocoa, cacao, large amounts of dairy (whole milk, heavy cream in shakes); dark soda, cola, energy drinks (high phosphorus and potassium); salt or high-sodium mixes",
      required: "low-potassium fruit base only — apple, grapes, blueberries, cranberry (unsweetened); prefer water, herbal tea, unsweetened cranberry juice, or small amounts of apple juice; if a smoothie is requested: apple + blueberry base ONLY — NEVER banana, plantain, or orange; moderate calories 150–200/serving; avoid high-phosphorus dairy-heavy bases.",
    },
  },

  // ── LIVER DISEASE / NAFLD / FATTY LIVER ────────────────────────────────────
  "liver-disease": {
    label: "Liver Disease",
    bannedKeywords: [
      ...ALCOHOL_KEYWORDS,
      ...RAW_SEAFOOD_KEYWORDS,
    ],
    safeVariants: ALCOHOL_SAFE_VARIANTS,
    calorieCap: null,
    prompt: {
      icon: "🫀",
      title: "LIVER DISEASE BEVERAGE SAFETY — MANDATORY (clinically required)",
      ban: "alcohol of any kind — beer, wine, liquor, cocktail ingredients — this is an absolute clinical hard stop with zero exceptions; raw shellfish or raw fish in any blended/liquid form; soda, energy drinks, sweet tea, fruit punch, juice cocktails (high sugar harms the liver); heavy syrup, candy-based flavoring, sweetened condensed milk, added sugar > 1 tsp; ultra-processed flavoring",
      required: "base = water, herbal tea, green tea, coconut water, or unsweetened plant milk; natural fruit sweetness only, no syrups; prefer liver-supportive ingredients: turmeric, ginger, lemon, beet, green tea, or berries when possible; 150–250 calories/serving.",
    },
  },

  // ── LIVER SUPPORT ──────────────────────────────────────────────────────────
  "liver-support": {
    label: "Liver Support",
    bannedKeywords: [
      ...ALCOHOL_KEYWORDS,
    ],
    safeVariants: ALCOHOL_SAFE_VARIANTS,
    calorieCap: null,
    prompt: {
      icon: "🌿",
      title: "LIVER SUPPORT BEVERAGE RULES — MANDATORY",
      ban: "alcohol of any kind; soda, energy drinks, sweet tea, juice cocktails; heavy syrup, processed artificial flavoring, candy-based ingredients; deep-fried additions or toppings",
      required: "light, whole-food base — herbal tea, green tea, plant milk, coconut water, or water; natural sweetness only (fruit, small amount of honey); prefer turmeric, ginger, green tea, lemon, or beet-based drinks when culturally appropriate.",
    },
  },

  // ── ONCOLOGY SUPPORT ───────────────────────────────────────────────────────
  oncology: {
    label: "Oncology Support",
    bannedKeywords: [
      ...ALCOHOL_KEYWORDS,
      ...RAW_SEAFOOD_KEYWORDS,
    ],
    safeVariants: ALCOHOL_SAFE_VARIANTS,
    calorieCap: null,
    prompt: {
      icon: "🎗️",
      title: "ONCOLOGY SUPPORT BEVERAGE SAFETY — MANDATORY (physician-assigned protocol)",
      ban: "alcohol of any kind — absolutely zero, no cocktail or cocktail-adjacent ingredients; raw shellfish, raw fish, or any raw/undercooked ingredient (infection risk during treatment); processed or deli meat additives; soda, energy drinks; high added sugar — heavy syrups, candy flavoring, sweetened condensed milk, added sugar > 1 tsp",
      required: "food safety is paramount — use only pasteurized dairy if dairy is used; prefer immune-supportive ingredients: green tea, ginger, turmeric, berries, tart cherry, pomegranate; protein-forward smoothies encouraged if appetite is reduced (Greek yogurt + berries, plant protein powder); 150–350 calories/serving; prioritize nutrient density over volume.",
    },
  },

  // ── DIABETIC BUILDER ───────────────────────────────────────────────────────
  diabetic: {
    label: "Diabetic (builder)",
    bannedKeywords: [
      "simple syrup", "condensed milk", "sweetened condensed milk",
      "corn syrup", "high fructose corn syrup",
    ],
    calorieCap: null,
    prompt: {
      icon: "🩺",
      title: "DIABETIC BEVERAGE RULES — beverage-specific (supplement to medical rules above)",
      ban: "simple syrup, honey > ½ tsp, agave > ½ tsp, flavored syrups, sweetened creamers, or fruit juice as the primary base (high glycemic spike)",
      required: "SWEETENER: stevia or monk fruit only if any sweetness is needed. SMOOTHIE BASE: low-GI fruits only — berries, green apple, tart cherry — NEVER banana, mango, or pineapple as the dominant ingredient. PREFER: plain Greek yogurt, unsweetened plant milk, or protein powder base; net carbs ≤ 20g/serving for standalone beverages.",
    },
  },

  // ── GLP-1 BUILDER ──────────────────────────────────────────────────────────
  glp1: {
    label: "GLP-1 (builder)",
    bannedKeywords: [],
    calorieCap: null,
    prompt: {
      icon: "💊",
      title: "GLP-1 BEVERAGE RULES — beverage-specific (supplement to medical rules above)",
      ban: "added sugar; heavy cream and full-fat ice cream as base; large-format or pitcher-style drinks",
      required: "single serving only (8–12 oz for smoothies and shakes); no added sugar; natural fruit sweetness in moderation only; plant milk or low-fat dairy base; if an alcoholic beverage is requested, limit to 1 standard drink equivalent max — prefer mocktail version. Prioritize protein-forward, low-volume, nutrient-dense options.",
    },
  },

  // ── ANTI-INFLAMMATORY BUILDER ──────────────────────────────────────────────
  "anti-inflammatory": {
    label: "Anti-Inflammatory (builder)",
    bannedKeywords: [],
    calorieCap: null,
    prompt: {
      icon: "🌿",
      title: "ANTI-INFLAMMATORY BEVERAGE RULES — beverage-specific (supplement to above)",
      ban: "soda, energy drinks, artificial sweeteners, high-sugar fruit juices, seed or vegetable oils, processed flavor syrups, refined white sugar",
      required: "prefer these specific ingredients: turmeric, ginger, cinnamon, green tea, matcha, tart cherry, pomegranate, beet, blueberry, spinach (in smoothies), coconut water, oat milk, almond milk. SWEETENER: small amount of raw honey, dates, or natural fruit sweetness only. BASE: unsweetened plant milk, green tea, water, or coconut water.",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Detection — maps envelope + builder to the active condition families
// ─────────────────────────────────────────────────────────────────────────────

export function detectActiveBeverageConditions(
  envelope: UserProtocolEnvelope,
  builder: BuilderKey | null,
): BeverageConditionFamily[] {
  const active: BeverageConditionFamily[] = [];
  const limits = envelope.medicalHardLimits.map(c => c.toLowerCase());
  const optimization = envelope.medicalOptimization.map(c => c.toLowerCase());
  const all = [...limits, ...optimization];

  if (limits.some(c =>
    c.includes("cardiac") || c.includes("heart disease") ||
    c.includes("heart failure") || c.includes("hypertension")
  )) active.push("cardiac");

  if (limits.some(c =>
    c.includes("renal") || c.includes("kidney") || c.includes("ckd")
  )) active.push("renal");

  const hasLiverDisease =
    limits.some(c => c.includes("liver disease") || c.includes("liver-disease")) ||
    optimization.some(c => c.includes("nafld") || c.includes("fatty liver"));
  if (hasLiverDisease) active.push("liver-disease");

  if (
    !hasLiverDisease &&
    all.some(c => c.includes("liver support") || c.includes("liver-support"))
  ) active.push("liver-support");

  if (all.some(c =>
    c.includes("oncology") || c.includes("oncology-support") || c.includes("cancer")
  )) active.push("oncology");

  if (builder === "diabetic") active.push("diabetic");
  if (builder === "glp1") active.push("glp1");
  if (builder === "anti_inflammatory") active.push("anti-inflammatory");

  return active;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt injection
// ─────────────────────────────────────────────────────────────────────────────

export function buildBeveragePromptBlocks(
  envelope: UserProtocolEnvelope,
  builder: BuilderKey | null,
): string {
  const conditions = detectActiveBeverageConditions(envelope, builder);
  if (conditions.length === 0) return "";

  const blocks = conditions.map(family => {
    const rule = BEVERAGE_CONDITION_RULES[family];
    return (
      `${rule.prompt.icon} ${rule.prompt.title}:\n` +
      `NEVER include: ${rule.prompt.ban}\n` +
      `REQUIRED: ${rule.prompt.required}`
    );
  });

  const labels = conditions.map(f => BEVERAGE_CONDITION_RULES[f].label).join(", ");
  console.log(`🔒 [BEVERAGE] Medical enforcement injected: [${labels}]`);

  return (
    `\n🔒 MEDICAL BEVERAGE SAFETY PROTOCOLS — ALL RULES BELOW ARE CLINICALLY MANDATORY:\n` +
    `${blocks.join("\n\n")}\n`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-generation validator
// ─────────────────────────────────────────────────────────────────────────────

type MealInput = {
  name?: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string; [k: string]: unknown }>;
  nutrition?: { calories?: number };
};

/**
 * Scans the generated beverage output against the active condition ban lists.
 *
 * Precision matching strategy:
 *   1. Build searchable text from ingredient.name, meal.name, meal.description
 *   2. For each banned keyword: substring-match against all text
 *   3. Before flagging: check if the matched text contains a safeVariant phrase
 *      (e.g. "non-alcoholic wine" matches "wine" but passes via safeVariant)
 *   4. Violations include `keyword` + `isAlcohol` fields for auto-fix routing
 */
export function validateBeverageOutput(
  meal: MealInput,
  envelope: UserProtocolEnvelope,
  builder: BuilderKey | null,
): BeverageValidationResult {
  const conditions = detectActiveBeverageConditions(envelope, builder);
  if (conditions.length === 0) {
    return { passed: true, violations: [], retryHint: "" };
  }

  const violations: BeverageViolation[] = [];

  const ingredientStrings = (meal.ingredients ?? []).map(i =>
    (i.name ?? i.item ?? "").toLowerCase()
  ).filter(Boolean);

  const nameAndDesc = [
    (meal.name ?? "").toLowerCase(),
    (meal.description ?? "").toLowerCase(),
  ];

  const allText = [...ingredientStrings, ...nameAndDesc];

  for (const family of conditions) {
    const rule = BEVERAGE_CONDITION_RULES[family];

    for (const keyword of rule.bannedKeywords) {
      const kw = keyword.toLowerCase();
      const hit = allText.find(text => text.includes(kw));
      if (!hit) continue;

      // ── Safe-variant check (false-positive protection) ────────────────────
      const safeList = rule.safeVariants?.[kw] ?? ALCOHOL_SAFE_VARIANTS[kw] ?? [];
      if (safeList.some(safe => hit.includes(safe.toLowerCase()))) continue;

      violations.push({
        condition: rule.label,
        ingredient: hit.trim(),
        rule: `"${keyword}" is banned for ${rule.label}`,
        correction: buildCorrection(family, keyword),
        keyword: kw,
        isAlcohol: ALCOHOL_KEYWORD_SET.has(kw),
      });
      break; // One violation per keyword per condition family is enough
    }

    if (rule.calorieCap !== null) {
      const cal = meal.nutrition?.calories ?? 0;
      if (cal > rule.calorieCap) {
        violations.push({
          condition: rule.label,
          ingredient: `nutrition.calories = ${cal}`,
          rule: `Calorie cap for ${rule.label} is ${rule.calorieCap} kcal/serving`,
          correction:
            `Reduce the recipe to ≤ ${rule.calorieCap} calories per serving. ` +
            `Use lower-calorie base (plant milk, water, or unsweetened tea) and ` +
            `reduce or eliminate any high-calorie sweeteners or toppings.`,
          keyword: "__calorie_cap__",
          isAlcohol: false,
        });
      }
    }
  }

  if (violations.length === 0) {
    return { passed: true, violations: [], retryHint: "" };
  }

  return { passed: false, violations, retryHint: buildRetryHint(violations) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-fix — surgical ingredient swap before burning an OpenAI retry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts a zero-latency fix for simple violations by swapping banned
 * ingredients with clinical-safe alternatives directly in the meal object.
 *
 * Returns null when the violations are NOT auto-fixable:
 *   - Any violation involves alcohol (requires full recipe reconstruction)
 *   - Any violation keyword lacks a swap in INGREDIENT_AUTO_FIXES
 *   - Violations involve the calorie cap (structural, not a single ingredient)
 *
 * When this returns non-null, the caller should mutate the meal object,
 * then immediately re-run validateBeverageOutput. If it passes, no OpenAI
 * retry is needed. If it still fails (rare edge case), fall through to retry.
 */
export function attemptBeverageAutoFix(
  meal: MealInput & { reasoning?: string },
  violations: BeverageViolation[],
): BeverageAutoFixResult | null {
  // Bail on alcohol violations — full mocktail rebuild required
  if (violations.some(v => v.isAlcohol)) return null;

  // Bail on calorie cap violations — structural, not a single ingredient
  if (violations.some(v => v.keyword === "__calorie_cap__")) return null;

  // Check every violation has a known swap
  const fixes: BeverageAutoFixResult["fixes"] = [];
  for (const violation of violations) {
    const swap = INGREDIENT_AUTO_FIXES[violation.keyword];
    if (!swap) return null;
    fixes.push({
      keyword: violation.keyword,
      replacement: swap,
      affectedText: violation.ingredient,
    });
  }

  // Apply patches to ingredient list — mutates in place for caller efficiency
  for (const ing of meal.ingredients ?? []) {
    const name = (ing.name ?? (ing as any).item ?? "").toLowerCase();
    for (const fix of fixes) {
      if (name.includes(fix.keyword)) {
        if ("name" in ing) {
          (ing as any).name = fix.replacement;
        } else {
          (ing as any).item = fix.replacement;
        }
        break;
      }
    }
  }

  const fixSummary = fixes.map(f => `${f.keyword} → ${f.replacement}`).join(", ");
  if (meal.reasoning !== undefined) {
    meal.reasoning += ` [Auto-corrected: ${fixSummary}]`;
  }

  return {
    fixes,
    note: `Auto-corrected ${fixes.length} violation(s) without AI retry: ${fixSummary}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildCorrection(family: BeverageConditionFamily, keyword: string): string {
  const corrections: Partial<Record<BeverageConditionFamily, Partial<Record<string, string>>>> = {
    cardiac: {
      "ice cream":               "Replace with frozen banana + plant milk + cultural flavoring for the same creamy texture.",
      "whole milk":              "Use oat milk, almond milk, soy milk, or low-fat milk instead.",
      "heavy cream":             "Use unsweetened oat milk or low-fat plant milk instead.",
      "half and half":           "Use oat milk instead.",
      "butter":                  "Omit entirely — butter has no role in a compliant cardiac beverage.",
      "coconut cream":           "Use light coconut milk if coconut flavor is needed.",
      "simple syrup":            "Use a small amount of natural fruit sweetness (½ tsp honey max) or omit entirely.",
      "condensed milk":          "Use unsweetened almond or oat milk with ½ tsp honey if sweetness is needed.",
      "sweetened condensed milk": "Use unsweetened plant milk — the drink's sweetness must come from fruit only.",
      "cream cheese":            "Use plain low-fat Greek yogurt instead.",
      "whipped cream":           "Omit entirely.",
    },
    renal: {
      "banana":        "Replace with blueberries as the smoothie base (low potassium).",
      "plantain":      "Replace with green apple (low potassium).",
      "orange juice":  "Replace with unsweetened cranberry juice or small-portion apple juice.",
      "citrus juice":  "Replace with unsweetened cranberry juice.",
      "citrus blend":  "Replace with unsweetened cranberry juice.",
      "tomato juice":  "Replace with cucumber water or herbal tea base.",
      "tomato":        "Omit entirely — high potassium.",
      "avocado":       "Omit entirely — high potassium. Use plain Greek yogurt for creaminess.",
      "chocolate":     "Use carob powder if a chocolate-like flavor is needed (low phosphorus).",
      "cocoa":         "Use carob powder — lower phosphorus alternative.",
      "cacao":         "Use carob powder — lower phosphorus alternative.",
      "peanut butter": "Use sunflower seed butter (lower phosphorus).",
      "nut butter":    "Use sunflower seed butter (lower phosphorus).",
      "cola":          "Replace with sparkling water or unsweetened herbal tea.",
      "energy drink":  "Replace with unsweetened green tea.",
    },
    "liver-disease": {
      default: "Remove ALL alcohol immediately. This is a clinical hard stop — rebuild the drink as a mocktail using the same flavor profile without any alcohol.",
    },
    "liver-support": {
      default: "Remove ALL alcohol. Replace with an equivalent non-alcoholic base that preserves the drink's flavor concept.",
    },
    oncology: {
      default: "Remove ALL alcohol and any raw/undercooked ingredients. Clinical hard stop — zero exceptions. Rebuild as a mocktail using pasteurized ingredients only.",
    },
    diabetic: {
      "simple syrup":            "Replace with stevia drops or monk fruit syrup (zero glycemic impact).",
      "condensed milk":          "Use unsweetened almond milk — the drink does not need a sweetener if fruit is present.",
      "sweetened condensed milk": "Use unsweetened almond milk.",
      "corn syrup":              "Use stevia syrup.",
      "high fructose corn syrup": "Use stevia syrup.",
    },
  };

  const familyMap = corrections[family];
  if (familyMap) {
    const specific = familyMap[keyword];
    if (specific) return specific;
    const def = (familyMap as any)["default"];
    if (def) return def;
  }

  const rule = BEVERAGE_CONDITION_RULES[family];
  return `Remove "${keyword}" entirely — it is clinically banned for ${rule.label}. ${rule.prompt.required}`;
}

function buildRetryHint(violations: BeverageViolation[]): string {
  const lines = violations.map(v =>
    `❌ CLINICAL VIOLATION [${v.condition}]: Found "${v.ingredient}" — ${v.rule}.\n   ↳ FIX: ${v.correction}`
  );
  return (
    `\n\n⚠️ PREVIOUS ATTEMPT FAILED CLINICAL VALIDATION — fix ALL of the following before regenerating:\n\n` +
    `${lines.join("\n\n")}\n\n` +
    `Regenerate the beverage with EVERY violation above resolved. ` +
    `The drink concept and cultural identity can be preserved — only swap the violating ingredients.`
  );
}
