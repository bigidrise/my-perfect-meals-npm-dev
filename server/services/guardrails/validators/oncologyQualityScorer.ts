/**
 * Cancer Support Nutrition — Meal Quality Scorer
 *
 * Implements a 0–100 scoring system that runs on every meal generated under the
 * oncology-support protocol AFTER the hard-block safety gate passes.
 *
 * Tiers:
 *   85–100  PREMIUM   — show as-is
 *   70–84   APPROVED  — show, no action needed
 *   50–69   IMPROVE   — regenerate with specific correction hint (do not show original)
 *   <50     REJECT    — regenerate entirely
 *
 * Required minimums (enforced regardless of score):
 *   - Clean protein present
 *   - Fiber anchor present
 *   - Vegetables present
 */

export type OncologyQualityTier = "premium" | "approved" | "improve" | "reject";

export interface OncologyScoreBreakdown {
  cleanProtein: number;         // 0–20
  fiberAnchor: number;          // 0–20
  antiInflamVegetables: number; // 0–20
  healthyFats: number;          // 0–15
  processingLevel: number;      // 0–15
  therapeuticBoosters: number;  // 0–10
}

export interface OncologyQualityResult {
  total: number;
  tier: OncologyQualityTier;
  breakdown: OncologyScoreBreakdown;
  missingRequirements: string[];
  regenerationHint: string | null;
  scoreLabel: string;
  approvedForDisplay: boolean;
}

// ─── Ingredient keyword lists ───────────────────────────────────────────────

const CLEAN_PROTEIN_PREMIUM = [
  "salmon", "cod", "halibut", "tilapia", "trout", "sardine", "mackerel",
  "egg", "eggs", "egg white", "tofu", "tempeh", "edamame", "lentil",
  "chickpea", "black bean", "kidney bean", "white bean", "navy bean",
  "greek yogurt", "cottage cheese",
];

const CLEAN_PROTEIN_GOOD = [
  "chicken breast", "chicken thigh", "chicken", "turkey breast", "turkey",
  "shrimp", "crab", "lobster", "clam", "mussel", "scallop",
];

const CLEAN_PROTEIN_MINIMAL = [
  "sirloin", "flank steak", "tenderloin", "lean beef", "bison", "venison",
  "pork loin", "pork tenderloin",
];

const FIBER_ANCHOR_STRONG = [
  "quinoa", "oat", "oatmeal", "lentil", "chickpea", "black bean", "kidney bean",
  "white bean", "navy bean", "edamame", "farro", "barley", "brown rice",
  "sweet potato", "butternut squash", "acorn squash", "beet", "whole wheat",
  "whole grain", "sprouted grain",
];

const FIBER_ANCHOR_LIGHT = [
  "spinach", "kale", "arugula", "lettuce", "mixed greens", "chard",
  "collard", "romaine", "cabbage", "cucumber", "zucchini", "celery",
];

const CRUCIFEROUS_VEGETABLES = [
  "broccoli", "cauliflower", "brussels sprout", "cabbage", "bok choy",
  "kale", "collard", "arugula", "radish", "turnip", "watercress",
];

const ANTI_INFLAM_VEGETABLES = [
  "mushroom", "spinach", "swiss chard", "beet", "carrot", "bell pepper",
  "tomato", "onion", "leek", "shallot", "asparagus", "artichoke",
  "zucchini", "eggplant", "pumpkin",
];

const HEALTHY_FATS_PREMIUM = [
  "olive oil", "avocado oil", "avocado", "walnut", "almond", "cashew",
  "pecan", "pistachio", "flaxseed", "chia seed", "hemp seed", "tahini",
  "pumpkin seed", "sunflower seed",
];

const HEALTHY_FATS_NEUTRAL = [
  "coconut oil", "butter", "ghee", "sesame oil",
];

const THERAPEUTIC_BOOSTERS = [
  "garlic", "turmeric", "ginger", "lemon", "lime", "blueberr", "raspberr",
  "strawberr", "blackberr", "cranberr", "pomegranate", "cherry",
  "fresh herb", "basil", "parsley", "cilantro", "rosemary", "thyme",
  "oregano", "mint", "dill", "cumin", "cinnamon", "black pepper",
  "cayenne", "paprika", "green tea",
];

const PROCESSED_INDICATORS = [
  "frozen dinner", "instant", "packaged", "canned soup", "cream of",
  "processed cheese", "american cheese", "velveeta", "spray",
];

// ─── Helper ──────────────────────────────────────────────────────────────────

function ingredientText(meal: ScoredMeal): string {
  const names: string[] = [];

  if (Array.isArray(meal.ingredients)) {
    for (const ing of meal.ingredients) {
      if (typeof ing === "string") names.push(ing);
      else if (ing && typeof ing === "object") {
        names.push(ing.name || ing.item || "");
      }
    }
  }

  return [meal.name || "", meal.description || "", ...names]
    .join(" ")
    .toLowerCase();
}

function contains(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t.toLowerCase()));
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface ScoredMeal {
  name?: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string } | string>;
}

// ─── Scorer ──────────────────────────────────────────────────────────────────

export function scoreOncologyMealQuality(meal: ScoredMeal): OncologyQualityResult {
  const text = ingredientText(meal);

  // 1. Clean Protein (0–20)
  let cleanProtein = 0;
  if (contains(text, CLEAN_PROTEIN_PREMIUM)) cleanProtein = 20;
  else if (contains(text, CLEAN_PROTEIN_GOOD)) cleanProtein = 15;
  else if (contains(text, CLEAN_PROTEIN_MINIMAL)) cleanProtein = 10;

  // 2. Fiber Anchor (0–20)
  // IMPORTANT: Only FIBER_ANCHOR_STRONG (quinoa/oats/lentils/beans/sweet potato/grains)
  // scores here. Leafy greens and light vegetables do NOT satisfy the fiber anchor gate.
  // They contribute to vegetable score below, never to fiber score.
  const hasStrongFiberAnchor = contains(text, FIBER_ANCHOR_STRONG);
  let fiberAnchor = 0;
  if (hasStrongFiberAnchor) fiberAnchor = 20;
  // Note: deliberately no "else if FIBER_ANCHOR_LIGHT" — greens ≠ fiber anchor

  // 3. Anti-Inflammatory Vegetables (0–20)
  // Leafy greens still contribute here (vegetable presence), just not to fiber.
  let antiInflamVegetables = 0;
  if (contains(text, CRUCIFEROUS_VEGETABLES)) antiInflamVegetables = 20;
  else if (contains(text, ANTI_INFLAM_VEGETABLES)) antiInflamVegetables = 15;
  else if (contains(text, FIBER_ANCHOR_LIGHT)) antiInflamVegetables = 5;

  // 4. Healthy Fats (0–15)
  let healthyFats = 0;
  if (contains(text, HEALTHY_FATS_PREMIUM)) healthyFats = 15;
  else if (contains(text, HEALTHY_FATS_NEUTRAL)) healthyFats = 8;

  // 5. Processing Level (0–15)
  let processingLevel = 15;
  if (contains(text, PROCESSED_INDICATORS)) processingLevel = 0;
  else if (
    text.includes("canned") ||
    text.includes("frozen") ||
    text.includes("pre-made") ||
    text.includes("premade")
  ) {
    processingLevel = 8;
  }

  // 6. Therapeutic Boosters (0–10)
  const hasTherapeuticBooster = contains(text, THERAPEUTIC_BOOSTERS);
  const therapeuticBoosters = hasTherapeuticBooster ? 10 : 0;

  // ── Green-tier protein flag ───────────────────────────────────────────────
  // Premium protein = fish, eggs, plant protein (cleanProtein === 20)
  // Good protein = lean poultry (cleanProtein === 15)
  // Both are green tier. Minimal (10) is borderline.
  const hasGreenTierProtein = cleanProtein >= 15;

  let rawTotal =
    cleanProtein +
    fiberAnchor +
    antiInflamVegetables +
    healthyFats +
    processingLevel +
    therapeuticBoosters;

  // ── Hard caps (enforce that specific quality pillars are truly present) ───
  // A meal that lacks a real fiber anchor, therapeutic booster, or green-tier
  // protein cannot score 85+ regardless of how well it does elsewhere.
  // Vegetables alone do NOT satisfy the fiber anchor cap.
  let cappedTotal = rawTotal;
  const caps: string[] = [];

  if (!hasStrongFiberAnchor) {
    cappedTotal = Math.min(cappedTotal, 84);
    caps.push("no-fiber-anchor");
  }
  if (!hasTherapeuticBooster) {
    cappedTotal = Math.min(cappedTotal, 84);
    caps.push("no-therapeutic-booster");
  }
  if (!hasGreenTierProtein) {
    cappedTotal = Math.min(cappedTotal, 84);
    caps.push("no-green-tier-protein");
  }

  const total = cappedTotal;

  // ── Required minimums ────────────────────────────────────────────────────
  const missingRequirements: string[] = [];

  const hasProtein = cleanProtein > 0;
  const hasFiber = hasStrongFiberAnchor; // greens alone do NOT satisfy this
  const hasVegetables =
    contains(text, CRUCIFEROUS_VEGETABLES) ||
    contains(text, ANTI_INFLAM_VEGETABLES) ||
    contains(text, FIBER_ANCHOR_LIGHT);

  if (!hasProtein) missingRequirements.push("clean protein");
  if (!hasFiber) missingRequirements.push("real fiber anchor (quinoa/oats/lentils/sweet potato — not just greens)");
  if (!hasVegetables) missingRequirements.push("vegetables");

  // ── Tier logic ───────────────────────────────────────────────────────────
  // Cancer Protocol standard: only 85+ is cleared for display.
  // 70-84 triggers auto-improvement (not shown to user).
  // <70 or missing required minimums → reject.
  const minimumsFailed = missingRequirements.length > 0;
  let tier: OncologyQualityTier;

  if (minimumsFailed || total < 70) {
    tier = "reject";
  } else if (total < 85) {
    tier = "improve";
  } else {
    tier = "premium";
  }

  // ── Regeneration hint ─────────────────────────────────────────────────────
  let regenerationHint: string | null = null;

  if (tier === "reject" || tier === "improve") {
    const hints: string[] = [
      "CANCER SUPPORT QUALITY IMPROVEMENT REQUIRED.",
    ];

    if (!hasProtein || cleanProtein < 15) {
      hints.push(
        "PROTEIN: Use a green-tier protein — fresh wild salmon, eggs, chicken breast, tofu, lentils, or chickpeas."
      );
    }

    if (!hasFiber || fiberAnchor < 20) {
      hints.push(
        "FIBER ANCHOR: Include a real fiber source — quinoa, oats, lentils, chickpeas, sweet potato, brown rice, farro, or berries. " +
          "Leafy greens alone are insufficient."
      );
    }

    if (!hasVegetables || antiInflamVegetables < 15) {
      hints.push(
        "VEGETABLES: Include anti-inflammatory vegetables — broccoli, cauliflower, kale, mushrooms, or bell peppers."
      );
    }

    if (healthyFats < 8) {
      hints.push(
        "FATS: Use olive oil, avocado, tahini, walnuts, or almonds as the fat source."
      );
    }

    if (therapeuticBoosters === 0) {
      hints.push(
        "BOOSTERS: Add therapeutic ingredients — garlic, turmeric, ginger, lemon, or fresh herbs."
      );
    }

    regenerationHint = hints.join(" ");
  }

  const scoreLabel =
    tier === "premium"
      ? `Optimized for Cancer Support (${total}/100)`
      : tier === "improve"
      ? `Needs quality improvement (${total}/100)`
      : `Below cancer protocol standard (${total}/100)`;

  const approvedForDisplay = tier === "premium";

  return {
    total,
    tier,
    breakdown: {
      cleanProtein,
      fiberAnchor,
      antiInflamVegetables,
      healthyFats,
      processingLevel,
      therapeuticBoosters,
    },
    missingRequirements,
    regenerationHint,
    scoreLabel,
    approvedForDisplay,
  };
}
