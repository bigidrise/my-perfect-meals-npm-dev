/**
 * Beverage Medical Rules — Single Source of Truth
 *
 * This module is the authoritative registry for all beverage-specific medical
 * and nutritional builder constraints. It drives two layers simultaneously:
 *
 *   1. PROMPT INJECTION  — buildBeveragePromptBlocks() injects explicit
 *      ingredient-level ban/require text into the AI prompt before generation.
 *
 *   2. POST-GEN VALIDATION — validateBeverageOutput() scans the returned
 *      ingredient list against the same structured ban lists and returns a
 *      typed result with specific violation messages for corrective retries.
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
  /** Human-readable label used in logs and violation messages */
  label: string;
  /**
   * Substring keywords matched against each ingredient.name (case-insensitive).
   * A match on ANY keyword is an immediate hard fail — no regeneration attempt
   * can proceed without a corrective hint naming the specific violation.
   */
  bannedKeywords: string[];
  /** Per-serving calorie ceiling; null = no numeric cap enforced by validator */
  calorieCap: number | null;
  /** Text blocks injected verbatim into the AI prompt */
  prompt: {
    icon: string;
    title: string;
    /** Comma/semicolon-separated list after "NEVER include:" */
    ban: string;
    /** Full REQUIRED sentence(s) */
    required: string;
  };
}

export interface BeverageViolation {
  condition: string;
  ingredient: string;
  rule: string;
  /** Corrective instruction surfaced in the retry hint */
  correction: string;
}

export interface BeverageValidationResult {
  passed: boolean;
  violations: BeverageViolation[];
  /** Ready-to-inject retry hint (empty string when passed) */
  retryHint: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared ban lists (reused across multiple conditions)
// ─────────────────────────────────────────────────────────────────────────────

const ALCOHOL_KEYWORDS: string[] = [
  "vodka", "rum", "gin", "tequila", "whiskey", "whisky", "bourbon",
  "wine", "beer", "champagne", "prosecco", "liqueur", "kahlúa", "kahlua",
  "amaretto", "baileys", "triple sec", "cointreau", "cognac", "brandy",
  "sake", "mead", "schnapps", "creme de", "midori", "aperol", "campari",
  "vermouth", "absinthe", "alcohol",
];

const RAW_SEAFOOD_KEYWORDS: string[] = [
  "raw oyster", "raw oysters", "raw clam", "raw clams",
  "raw shellfish", "raw fish", "raw sushi", "raw sashimi",
];

// ─────────────────────────────────────────────────────────────────────────────
// Rule registry — one entry per condition family
// ─────────────────────────────────────────────────────────────────────────────

export const BEVERAGE_CONDITION_RULES: Record<BeverageConditionFamily, BeverageRuleSet> = {

  // ── CARDIAC / HEART DISEASE / HYPERTENSION ─────────────────────────────────
  cardiac: {
    label: "Cardiac / Heart Disease",
    bannedKeywords: [
      "ice cream", "whole milk", "heavy cream", "butter", "coconut cream",
      "simple syrup", "condensed milk", "sweetened condensed milk",
      "cream cheese", "whipped cream", "half and half",
      ...ALCOHOL_KEYWORDS,
    ],
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
      // High-potassium
      "banana", "orange juice", "tomato juice", "tomato", "avocado",
      // High-phosphorus
      "chocolate", "cocoa powder", "cocoa", "peanut butter", "nut butter",
      // High-phosphorus sodas
      "cola", "coca-cola", "pepsi", "dark soda",
      // Energy drinks
      "energy drink", "red bull", "monster energy", "bang energy",
    ],
    calorieCap: 200,
    prompt: {
      icon: "🫘",
      title: "RENAL / KIDNEY DISEASE BEVERAGE SAFETY — MANDATORY (clinically required)",
      ban: "high-potassium ingredients — banana, orange, orange juice, tomato juice, avocado, spinach-dominant juices, potato-based drinks; high-phosphorus — nuts, seeds, chocolate, cocoa, large amounts of dairy (whole milk, heavy cream in shakes); dark soda, cola, energy drinks (high phosphorus and potassium); salt or high-sodium mixes",
      required: "low-potassium fruit base only — apple, grapes, blueberries, cranberry (unsweetened); prefer water, herbal tea, unsweetened cranberry juice, or small amounts of apple juice; if a smoothie is requested: apple + blueberry base ONLY — NEVER banana or orange; moderate calories 150–200/serving; avoid high-phosphorus dairy-heavy bases.",
    },
  },

  // ── LIVER DISEASE / NAFLD / FATTY LIVER ────────────────────────────────────
  "liver-disease": {
    label: "Liver Disease",
    bannedKeywords: [
      ...ALCOHOL_KEYWORDS,
      ...RAW_SEAFOOD_KEYWORDS,
    ],
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
      "simple syrup", "condensed milk", "sweetened condensed milk", "corn syrup",
      "high fructose corn syrup",
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
    // Prompt-only — ingredient intent is hard to detect from names alone;
    // the prompt constraint carries the enforcement load for this builder.
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
    // Prompt-only — the required/avoid ingredients are too context-dependent
    // (e.g., "soda" is fine in sparkling water form) for keyword matching.
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

  if (all.some(c => c.includes("oncology") || c.includes("oncology-support") || c.includes("cancer"))) {
    active.push("oncology");
  }

  if (builder === "diabetic") active.push("diabetic");
  if (builder === "glp1") active.push("glp1");
  if (builder === "anti_inflammatory") active.push("anti-inflammatory");

  return active;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt injection — replaces the inline buildMedicalBeverageEnforcement()
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
// Post-generation validator — hard gate before output reaches the user
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans every ingredient in the generated beverage output against the active
 * condition ban lists. Returns a typed result; on failure the `retryHint`
 * string is ready to be appended to the next prompt attempt verbatim.
 *
 * Scan strategy:
 *   - ingredient.name (primary)
 *   - meal.name (catches "Rum & Coke" style names)
 *   - meal.description (secondary signal)
 * All comparisons are case-insensitive substring matches.
 */
export function validateBeverageOutput(
  meal: {
    name?: string;
    description?: string;
    ingredients?: Array<{ name?: string; item?: string; [k: string]: unknown }>;
    nutrition?: { calories?: number };
  },
  envelope: UserProtocolEnvelope,
  builder: BuilderKey | null,
): BeverageValidationResult {
  const conditions = detectActiveBeverageConditions(envelope, builder);
  if (conditions.length === 0) {
    return { passed: true, violations: [], retryHint: "" };
  }

  const violations: BeverageViolation[] = [];

  // Build a flat list of searchable strings from the output
  const ingredientStrings = (meal.ingredients ?? []).map(i =>
    (i.name ?? i.item ?? "").toLowerCase()
  ).filter(Boolean);

  // Also scan the meal name and description for alcohol/raw terms that might
  // appear there even if not listed as an ingredient (e.g., "Rum Punch")
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
      if (hit) {
        violations.push({
          condition: rule.label,
          ingredient: hit.trim(),
          rule: `"${keyword}" is banned for ${rule.label}`,
          correction: buildCorrection(family, keyword),
        });
        // One violation per keyword is enough — no need to surface duplicates
        break;
      }
    }

    // Calorie cap check (uses nutrition.calories from the AI output)
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
        });
      }
    }
  }

  if (violations.length === 0) {
    return { passed: true, violations: [], retryHint: "" };
  }

  const retryHint = buildRetryHint(violations);
  return { passed: false, violations, retryHint };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildCorrection(family: BeverageConditionFamily, keyword: string): string {
  const corrections: Partial<Record<BeverageConditionFamily, Partial<Record<string, string>>>> = {
    cardiac: {
      "ice cream": "Replace with frozen banana + plant milk + cultural flavoring for the same creamy texture.",
      "whole milk": "Use oat milk, almond milk, soy milk, or low-fat milk instead.",
      "heavy cream": "Use oat milk or low-fat plant milk instead.",
      "simple syrup": "Use a small amount of natural fruit sweetness or omit entirely.",
      "condensed milk": "Omit or use unsweetened plant milk with a tiny amount of honey (≤ 1 tsp).",
      "sweetened condensed milk": "Omit or use unsweetened plant milk with a tiny amount of honey (≤ 1 tsp).",
    },
    renal: {
      "banana": "Replace with apple, blueberry, or cranberry as the smoothie base.",
      "orange juice": "Replace with unsweetened cranberry juice or small-portion apple juice.",
      "tomato": "Omit entirely — high potassium. Use cucumber water or herbal tea base.",
      "avocado": "Omit entirely — high potassium.",
      "chocolate": "Omit entirely — high phosphorus. Use carob powder only if needed.",
      "cocoa": "Omit entirely — high phosphorus.",
      "cola": "Replace with sparkling water, lemon water, or herbal tea.",
      "energy drink": "Replace with plain water, herbal tea, or coconut water.",
    },
    "liver-disease": {
      default: "Remove ALL alcohol. This is a clinical hard stop — use a mocktail base instead.",
    },
    oncology: {
      default: "Remove ALL alcohol and any raw/undercooked ingredients. Clinical hard stop — zero exceptions.",
    },
  };

  const familyMap = corrections[family];
  if (familyMap) {
    const specific = familyMap[keyword];
    if (specific) return specific;
    const def = familyMap["default"];
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
    `\n\n⚠️ PREVIOUS ATTEMPT FAILED CLINICAL VALIDATION — you MUST fix ALL of the following before regenerating:\n\n` +
    `${lines.join("\n\n")}\n\n` +
    `Regenerate the beverage with EVERY violation above resolved. ` +
    `The drink concept and cultural identity can be preserved — only swap the violating ingredients.`
  );
}
