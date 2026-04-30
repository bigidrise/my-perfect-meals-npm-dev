/**
 * Oncology Support — Lightweight Snack Quality Scorer
 *
 * Snacks serve a different clinical purpose than meals:
 * "Support the system between meals" (not "build a complete plate").
 *
 * Scoring: 0–100 across 4 pillars of 25 points each.
 * Approval threshold: 70+ (vs 85+ for full meals).
 * No 20g protein gate or fiber anchor mandate — those are meal-level rules.
 *
 * Hard caps (cap score at 69 = force regeneration):
 *   - No recognizable clean protein at all → cap at 69
 *   - Contains processed/junk ingredients → cap at 69
 */

// ── Ingredient lists ─────────────────────────────────────────────────────────

const CLEAN_PROTEIN_SNACK = [
  "greek yogurt", "cottage cheese", "tofu", "edamame",
  "almonds", "walnuts", "cashews", "pistachios", "pecans",
  "pumpkin seeds", "hemp seeds", "chia seeds", "sunflower seeds",
  "hard boiled egg", "hard-boiled egg", "boiled egg",
  "turkey", "chicken", "tuna", "salmon", "sardines",
  "lentils", "chickpeas", "hummus", "black beans",
  "protein powder", "collagen", "peanut butter", "almond butter",
  "sunflower butter", "tahini",
];

const ANTI_INFLAMMATORY_SNACK = [
  "blueberries", "strawberries", "raspberries", "blackberries",
  "cherries", "pomegranate", "açaí", "acai",
  "turmeric", "ginger", "cinnamon",
  "garlic", "parsley", "cilantro", "basil",
  "dark chocolate", "cacao", "cocoa",
  "green tea", "matcha",
  "spinach", "kale", "arugula", "broccoli",
  "walnuts", "flaxseed", "flax seeds", "hemp seeds",
  "berries", "mango", "papaya", "avocado",
];

const HEALTHY_FAT_FIBER_SNACK = [
  "almonds", "walnuts", "pecans", "cashews", "pistachios",
  "almond butter", "peanut butter", "sunflower butter", "tahini",
  "avocado", "guacamole",
  "chia seeds", "flaxseed", "flax seeds", "hemp seeds",
  "olives", "olive oil",
  "apple", "pear", "banana",
  "oats", "rolled oats",
  "hummus",
  "coconut", "coconut flakes",
];

const PROCESSED_JUNK_SNACK = [
  "potato chip", "tortilla chip", "corn chip",
  "candy", "gummy", "gummies", "skittles", "starburst",
  "cookie", "brownie", "cake", "donut", "doughnut",
  "soda", "cola", "energy drink", "sports drink",
  "hot dog", "processed meat", "lunch meat", "deli meat",
  "white bread", "wonder bread", "crackers with hydrogenated",
  "high fructose", "corn syrup",
  "hydrogenated", "trans fat",
  "artificial flavoring",
  "deep fried", "deep-fried",
];

const SUGAR_HEAVY_SNACK = [
  "candy bar", "chocolate bar with sugar",
  "fruit juice", "orange juice", "apple juice",
  "ice cream", "gelato", "sherbet",
  "syrup", "honey roasted",
  "sugar-coated",
];

// ── Types ────────────────────────────────────────────────────────────────────

export type OncologySnackTier = "approved" | "improve" | "reject";

export interface OncologySnackScoreBreakdown {
  cleanProtein: number;       // 0–25
  antiInflammatory: number;   // 0–25
  healthyFatOrFiber: number;  // 0–25
  lowProcessing: number;      // 0–25
  rawTotal: number;
  cappedTotal: number;
  caps: string[];
}

export interface OncologySnackQualityResult {
  total: number;
  tier: OncologySnackTier;
  approvedForDisplay: boolean;
  breakdown: OncologySnackScoreBreakdown;
  regenerationHint: string | null;
}

export interface ScoredSnack {
  name: string;
  ingredients: Array<{ name: string; quantity?: string; unit?: string }> | string[];
  description?: string;
  protein?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSnackText(snack: ScoredSnack): string {
  const namePart = snack.name || "";
  const descPart = snack.description || "";
  const ingPart = Array.isArray(snack.ingredients)
    ? snack.ingredients
        .map((i: any) => (typeof i === "string" ? i : i.name || ""))
        .join(" ")
    : "";
  return `${namePart} ${descPart} ${ingPart}`.toLowerCase();
}

function containsAny(text: string, list: string[]): boolean {
  return list.some((term) => text.includes(term));
}

// ── Scorer ───────────────────────────────────────────────────────────────────

export function scoreOncologySnackQuality(snack: ScoredSnack): OncologySnackQualityResult {
  const text = buildSnackText(snack);

  // 1. Clean Protein (0–25)
  const hasCleanProtein = containsAny(text, CLEAN_PROTEIN_SNACK);
  const cleanProtein = hasCleanProtein ? 25 : 0;

  // 2. Anti-Inflammatory Ingredient (0–25)
  const hasAntiInflammatory = containsAny(text, ANTI_INFLAMMATORY_SNACK);
  const antiInflammatory = hasAntiInflammatory ? 25 : 0;

  // 3. Healthy Fat or Fiber Support (0–25)
  const hasHealthyFatOrFiber = containsAny(text, HEALTHY_FAT_FIBER_SNACK);
  const healthyFatOrFiber = hasHealthyFatOrFiber ? 25 : 0;

  // 4. Low Processing (0–25): starts full, deducted for junk/sugar
  let lowProcessing = 25;
  if (containsAny(text, PROCESSED_JUNK_SNACK)) lowProcessing = 0;
  else if (containsAny(text, SUGAR_HEAVY_SNACK)) lowProcessing = 5;

  const rawTotal = cleanProtein + antiInflammatory + healthyFatOrFiber + lowProcessing;

  // ── Hard caps ──────────────────────────────────────────────────────────────
  // Missing clean protein OR processed junk → force regeneration (cap below 70)
  let cappedTotal = rawTotal;
  const caps: string[] = [];

  if (!hasCleanProtein) {
    cappedTotal = Math.min(cappedTotal, 69);
    caps.push("no-clean-protein");
  }
  if (lowProcessing === 0) {
    cappedTotal = Math.min(cappedTotal, 69);
    caps.push("processed-junk");
  }

  const total = cappedTotal;

  // ── Tier ───────────────────────────────────────────────────────────────────
  let tier: OncologySnackTier;
  if (total < 70) {
    tier = "improve";
  } else {
    tier = "approved";
  }
  // Note: no "reject" tier for snacks — they're lighter and a failed-but-safe
  // snack is still regenerated, not hard-blocked.

  const approvedForDisplay = tier === "approved";

  // ── Regeneration hint ──────────────────────────────────────────────────────
  let regenerationHint: string | null = null;

  if (!approvedForDisplay) {
    const hints: string[] = [
      "CANCER SUPPORT SNACK QUALITY REQUIRED.",
    ];

    if (!hasCleanProtein) {
      hints.push(
        "PROTEIN: Include a clean protein — Greek yogurt, cottage cheese, nuts, seeds, hummus, hard-boiled egg, or nut butter."
      );
    }
    if (!hasAntiInflammatory) {
      hints.push(
        "ANTI-INFLAMMATORY: Add berries, dark chocolate (70%+), turmeric, ginger, or leafy greens."
      );
    }
    if (!hasHealthyFatOrFiber) {
      hints.push(
        "HEALTHY FAT/FIBER: Include almonds, walnuts, chia seeds, avocado, or oats."
      );
    }
    if (lowProcessing === 0) {
      hints.push(
        "AVOID PROCESSED FOOD: Remove chips, candy, sugar-heavy items. Use whole food alternatives."
      );
    }

    hints.push(
      "TARGET: A great oncology snack looks like: Greek yogurt + berries + chia seeds, " +
        "OR apple slices + almond butter + cinnamon, OR walnuts + dark chocolate + blueberries."
    );

    regenerationHint = hints.join(" ");
  }

  return {
    total,
    tier,
    approvedForDisplay,
    breakdown: {
      cleanProtein,
      antiInflammatory,
      healthyFatOrFiber,
      lowProcessing,
      rawTotal,
      cappedTotal,
      caps,
    },
    regenerationHint,
  };
}
