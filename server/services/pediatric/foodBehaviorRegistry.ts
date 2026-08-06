/**
 * Food Behavior Registry
 *
 * Every food entry describes how that food behaves across each developmental stage.
 * This is the authoritative source for food-level safety decisions — not prompt text.
 *
 * Fields:
 *   allowed          — whether the food is permitted at this stage
 *   preparationRequired — what preparation is mandatory (if any)
 *   servingSizeGuidance — age-appropriate serving guidance
 *   chokingRisk      — choking hazard level for this stage
 *   allergenRisk     — whether this food carries major allergen risk
 *   schoolSafe       — whether the food is safe to send to school
 *   evidenceNote     — evidence basis for the restriction
 */

export type DevelopmentalStage =
  | "early_infant"
  | "beginning_foods"
  | "young_toddler"
  | "toddler"
  | "preschool"
  | "early_school_age"
  | "growing_child";

export type AllowedStatus =
  | true                  // fully allowed as-is
  | "with_preparation"    // allowed only with specified preparation
  | "clinician_only"      // requires clinician clearance before offering
  | "blocked";            // hard stop — must not appear in any form

export type ChokingRisk = "critical" | "high" | "moderate" | "low" | "none";

export interface StageBehavior {
  allowed: AllowedStatus;
  preparationRequired?: string;
  servingSizeGuidance?: string;
  chokingRisk: ChokingRisk;
  allergenRisk?: boolean;
  schoolSafe?: boolean;
  evidenceNote?: string;
}

export interface FoodBehaviorEntry {
  foodId: string;
  displayName: string;
  aliases?: string[];           // alternative names / common spellings
  stages: Partial<Record<DevelopmentalStage, StageBehavior>>;
  universalNotes?: string;
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const FOOD_BEHAVIOR_REGISTRY: FoodBehaviorEntry[] = [
  // ── HONEY ────────────────────────────────────────────────────────────────
  {
    foodId: "honey",
    displayName: "Honey",
    aliases: ["raw honey", "manuka honey", "clover honey", "honeycomb"],
    stages: {
      early_infant: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP: infant botulism risk; Clostridium botulinum spores; hard stop under 12 months.",
      },
      beginning_foods: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP: infant botulism risk; hard stop under 12 months.",
      },
      young_toddler: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP / WHO: honey is contraindicated through 23 months due to botulism risk.",
      },
      toddler: {
        allowed: true,
        chokingRisk: "none",
        servingSizeGuidance: "Small amounts only; added sugar guidance applies.",
        evidenceNote: "Safe after 24 months; botulism risk resolved.",
      },
      preschool:         { allowed: true, chokingRisk: "none" },
      early_school_age:  { allowed: true, chokingRisk: "none" },
      growing_child:     { allowed: true, chokingRisk: "none" },
    },
  },

  // ── WHOLE GRAPES ─────────────────────────────────────────────────────────
  {
    foodId: "whole_grapes",
    displayName: "Grapes (whole)",
    aliases: ["grape", "grapes", "seedless grapes", "red grapes", "green grapes"],
    stages: {
      beginning_foods: {
        allowed: "with_preparation",
        preparationRequired: "Peel and mash or purée completely. Do not serve in any round form.",
        chokingRisk: "critical",
        evidenceNote: "Spherical shape exactly matches infant airway diameter; CPSC/AAP choking hazard.",
      },
      young_toddler: {
        allowed: "with_preparation",
        preparationRequired: "Quarter lengthwise — not halved, not whole. Remove skin if possible.",
        chokingRisk: "critical",
        evidenceNote: "AAP: whole grapes are the #1 pediatric choking food; must be quartered lengthwise.",
      },
      toddler: {
        allowed: "with_preparation",
        preparationRequired: "Quarter lengthwise. Skin may remain if child is a confident chewer.",
        chokingRisk: "high",
        evidenceNote: "ACAAI / AAP: quartering required through toddler years.",
      },
      preschool: {
        allowed: "with_preparation",
        preparationRequired: "Halve or quarter. Supervise eating.",
        chokingRisk: "moderate",
      },
      early_school_age: { allowed: true, chokingRisk: "low" },
      growing_child:    { allowed: true, chokingRisk: "none" },
    },
  },

  // ── WHOLE NUTS ───────────────────────────────────────────────────────────
  {
    foodId: "whole_nuts",
    displayName: "Whole Nuts (all varieties)",
    aliases: [
      "peanuts", "almonds", "cashews", "walnuts", "pecans", "hazelnuts",
      "macadamia nuts", "pine nuts", "pistachios", "chestnuts", "mixed nuts",
    ],
    universalNotes: "Nut butters (smooth) are allowed from beginning_foods for allergy-introduction purposes.",
    stages: {
      early_infant:     { allowed: "blocked", chokingRisk: "critical", evidenceNote: "Solid choking hazard; not developmentally appropriate." },
      beginning_foods:  { allowed: "blocked", chokingRisk: "critical", evidenceNote: "Whole or large pieces: hard stop. Finely ground or smooth butter only." },
      young_toddler:    { allowed: "blocked", chokingRisk: "critical", evidenceNote: "AAP: whole nuts are not safe until age 4+." },
      toddler:          { allowed: "blocked", chokingRisk: "critical", evidenceNote: "AAP: whole nuts not safe before age 4." },
      preschool: {
        allowed: "with_preparation",
        preparationRequired: "Finely chopped only; no whole or large pieces.",
        chokingRisk: "high",
        evidenceNote: "Age 4–5: chopped nuts may be introduced cautiously with supervision.",
      },
      early_school_age: {
        allowed: "with_preparation",
        preparationRequired: "Chop for mixed dishes; whole nuts for confident chewers only.",
        chokingRisk: "moderate",
        schoolSafe: false,
      },
      growing_child: { allowed: true, chokingRisk: "low", schoolSafe: false },
    },
  },

  // ── POPCORN ──────────────────────────────────────────────────────────────
  {
    foodId: "popcorn",
    displayName: "Popcorn",
    aliases: ["air-popped popcorn", "microwave popcorn", "kettle corn"],
    stages: {
      early_infant:    { allowed: "blocked", chokingRisk: "critical" },
      beginning_foods: { allowed: "blocked", chokingRisk: "critical", evidenceNote: "AAP: hard stop under 4 years." },
      young_toddler:   { allowed: "blocked", chokingRisk: "critical", evidenceNote: "AAP: hard stop under 4 years." },
      toddler:         { allowed: "blocked", chokingRisk: "critical", evidenceNote: "AAP: hard stop under 4 years." },
      preschool: {
        allowed: "blocked",
        chokingRisk: "critical",
        evidenceNote: "AAP recommends avoiding popcorn until age 4+; pre-schoolers (age 4–5) are at the cusp — blocked by default for safety.",
      },
      early_school_age: {
        allowed: true,
        chokingRisk: "low",
        servingSizeGuidance: "Age-appropriate serving; supervise first experiences.",
      },
      growing_child: { allowed: true, chokingRisk: "none" },
    },
  },

  // ── RAW CARROTS ──────────────────────────────────────────────────────────
  {
    foodId: "raw_carrot",
    displayName: "Raw Carrots",
    aliases: ["raw carrot", "baby carrots", "carrot sticks"],
    stages: {
      early_infant:    { allowed: "blocked", chokingRisk: "critical" },
      beginning_foods: {
        allowed: "with_preparation",
        preparationRequired: "Must be steamed until very soft, then puréed or mashed. Raw form prohibited.",
        chokingRisk: "critical",
        evidenceNote: "Hard raw texture combined with cylindrical shape creates critical choking risk.",
      },
      young_toddler: {
        allowed: "with_preparation",
        preparationRequired: "Steam until soft, then cut into very small pieces OR grate raw. No whole sticks or coins.",
        chokingRisk: "high",
        evidenceNote: "AAP: raw hard vegetables are a choking risk through 24 months.",
      },
      toddler: {
        allowed: "with_preparation",
        preparationRequired: "Cut into thin strips or very small pieces. Steamed preferred. No large coins.",
        chokingRisk: "moderate",
      },
      preschool:        { allowed: true, chokingRisk: "low", preparationRequired: "Cut into thin matchsticks or coins; supervise." },
      early_school_age: { allowed: true, chokingRisk: "none" },
      growing_child:    { allowed: true, chokingRisk: "none" },
    },
  },

  // ── RAW CELERY ───────────────────────────────────────────────────────────
  {
    foodId: "raw_celery",
    displayName: "Raw Celery",
    aliases: ["celery sticks", "celery"],
    stages: {
      early_infant:    { allowed: "blocked", chokingRisk: "critical" },
      beginning_foods: {
        allowed: "with_preparation",
        preparationRequired: "Steam until very soft and purée. Strings must be fully removed.",
        chokingRisk: "critical",
        evidenceNote: "Stringy fibrous texture + hard raw form: choking and string-detachment hazard.",
      },
      young_toddler: {
        allowed: "with_preparation",
        preparationRequired: "Remove strings, steam, and cut very small. No raw sticks.",
        chokingRisk: "high",
      },
      toddler: {
        allowed: "with_preparation",
        preparationRequired: "Strings removed; cut into small pieces; cooked preferred.",
        chokingRisk: "moderate",
      },
      preschool:        { allowed: true, chokingRisk: "low" },
      early_school_age: { allowed: true, chokingRisk: "none" },
      growing_child:    { allowed: true, chokingRisk: "none" },
    },
  },

  // ── CHERRY TOMATOES ──────────────────────────────────────────────────────
  {
    foodId: "cherry_tomatoes",
    displayName: "Cherry Tomatoes",
    aliases: ["grape tomatoes", "cherry tomato", "mini tomatoes"],
    stages: {
      beginning_foods: {
        allowed: "with_preparation",
        preparationRequired: "Quarter or mash completely. No whole or halved cherry tomatoes.",
        chokingRisk: "critical",
      },
      young_toddler: {
        allowed: "with_preparation",
        preparationRequired: "Halve or quarter. Never serve whole.",
        chokingRisk: "high",
      },
      toddler: {
        allowed: "with_preparation",
        preparationRequired: "Halve or quarter. Supervise.",
        chokingRisk: "moderate",
      },
      preschool:        { allowed: true, chokingRisk: "low" },
      early_school_age: { allowed: true, chokingRisk: "none" },
      growing_child:    { allowed: true, chokingRisk: "none" },
    },
  },

  // ── HARD CANDY ───────────────────────────────────────────────────────────
  {
    foodId: "hard_candy",
    displayName: "Hard Candy",
    aliases: ["lollipop", "jawbreaker", "lozenge", "boiled sweets", "rock candy", "candy cane"],
    stages: {
      early_infant:    { allowed: "blocked", chokingRisk: "critical" },
      beginning_foods: { allowed: "blocked", chokingRisk: "critical", evidenceNote: "Not appropriate at any level — added sugar + choking." },
      young_toddler:   { allowed: "blocked", chokingRisk: "critical" },
      toddler:         { allowed: "blocked", chokingRisk: "critical" },
      preschool:       { allowed: "blocked", chokingRisk: "critical", evidenceNote: "AAP: hard candy is a choking hazard through age 5+." },
      early_school_age: {
        allowed: "blocked",
        chokingRisk: "high",
        evidenceNote: "Choking risk remains elevated through age 8; avoid hard candy.",
      },
      growing_child: { allowed: true, chokingRisk: "low" },
    },
  },

  // ── COW'S MILK AS MAIN DRINK ─────────────────────────────────────────────
  {
    foodId: "cows_milk_main_drink",
    displayName: "Cow's Milk (as primary drink)",
    aliases: ["whole milk", "dairy milk", "full-fat milk"],
    universalNotes: "Cow's milk as ingredient in cooking or small amounts in foods is fine from 6 months onward. This entry governs cow's milk as the PRIMARY drink replacing breast milk or formula.",
    stages: {
      early_infant: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP: breast milk or formula is the only appropriate primary drink; cow's milk not nutritionally complete for infants.",
      },
      beginning_foods: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP: cow's milk must not replace breast milk or formula before 12 months.",
      },
      young_toddler: {
        allowed: true,
        chokingRisk: "none",
        servingSizeGuidance: "Up to 16–24 oz/day whole milk; do not exceed.",
        evidenceNote: "AAP: transition to whole cow's milk is appropriate after 12 months.",
      },
      toddler:          { allowed: true, chokingRisk: "none", servingSizeGuidance: "16–24 oz/day; 2% or whole milk." },
      preschool:        { allowed: true, chokingRisk: "none" },
      early_school_age: { allowed: true, chokingRisk: "none" },
      growing_child:    { allowed: true, chokingRisk: "none" },
    },
  },

  // ── JUICE ────────────────────────────────────────────────────────────────
  {
    foodId: "fruit_juice",
    displayName: "Fruit Juice (100%)",
    aliases: ["juice", "apple juice", "orange juice", "grape juice", "fruit juice"],
    stages: {
      early_infant: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP 2017: no juice under 12 months.",
      },
      beginning_foods: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP 2017: no juice under 12 months.",
      },
      young_toddler: {
        allowed: "clinician_only",
        chokingRisk: "none",
        servingSizeGuidance: "AAP: limit to 4 oz/day for ages 1–3 if offered; water preferred.",
        evidenceNote: "AAP: juice provides no nutritional benefit over whole fruit; displaces more nutritious foods.",
      },
      toddler:          { allowed: true, chokingRisk: "none", servingSizeGuidance: "Max 4 oz/day; whole fruit preferred." },
      preschool:        { allowed: true, chokingRisk: "none", servingSizeGuidance: "Max 4–6 oz/day." },
      early_school_age: { allowed: true, chokingRisk: "none", servingSizeGuidance: "Max 8 oz/day." },
      growing_child:    { allowed: true, chokingRisk: "none" },
    },
  },

  // ── HIGH-MERCURY FISH ────────────────────────────────────────────────────
  {
    foodId: "high_mercury_fish",
    displayName: "High-Mercury Fish",
    aliases: [
      "swordfish", "shark", "king mackerel", "tilefish", "bigeye tuna",
      "orange roughy", "marlin",
    ],
    stages: {
      early_infant:     { allowed: "blocked", chokingRisk: "none", evidenceNote: "FDA/EPA: avoid high-mercury fish for all children." },
      beginning_foods:  { allowed: "blocked", chokingRisk: "none", evidenceNote: "FDA/EPA: hard stop — developmental neurotoxin risk." },
      young_toddler:    { allowed: "blocked", chokingRisk: "none", evidenceNote: "FDA/EPA: avoid in all children under 11." },
      toddler:          { allowed: "blocked", chokingRisk: "none" },
      preschool:        { allowed: "blocked", chokingRisk: "none" },
      early_school_age: { allowed: "blocked", chokingRisk: "none", evidenceNote: "FDA/EPA: avoid swordfish, shark, king mackerel, tilefish, bigeye tuna in children." },
      growing_child:    { allowed: "blocked", chokingRisk: "none" },
    },
  },

  // ── ADDED SUGAR (as primary ingredient) ─────────────────────────────────
  {
    foodId: "added_sugar",
    displayName: "Added Sugar (as primary ingredient)",
    aliases: ["sugar", "cane sugar", "table sugar", "brown sugar", "corn syrup", "agave syrup"],
    universalNotes: "This entry flags added sugar as the dominant recipe ingredient (e.g. candy, sugar syrup dishes). Small amounts for palatability/binding in cooking are handled separately.",
    stages: {
      early_infant: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "WHO / AAP: no added sugar under 6 months; breast milk or formula only.",
      },
      beginning_foods: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP / WHO: no added sugar under 12 months; disrupts palate development.",
      },
      young_toddler: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "AAP / AHA: no added sugar under 24 months.",
      },
      toddler:          { allowed: "with_preparation", chokingRisk: "none", preparationRequired: "Minimize; use naturally sweet ingredients wherever possible.", servingSizeGuidance: "AHA: limit to <25g added sugar/day for children 2+." },
      preschool:        { allowed: true, chokingRisk: "none", servingSizeGuidance: "Limit; AHA <25g/day." },
      early_school_age: { allowed: true, chokingRisk: "none" },
      growing_child:    { allowed: true, chokingRisk: "none" },
    },
  },

  // ── ADDED SALT (high-sodium as primary) ──────────────────────────────────
  {
    foodId: "added_salt",
    displayName: "Added Salt / High-Sodium Ingredients",
    aliases: ["salt", "sodium", "soy sauce", "table salt", "sea salt", "kosher salt"],
    stages: {
      early_infant: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "Infant kidneys cannot handle excess sodium; no added salt under 6 months.",
      },
      beginning_foods: {
        allowed: "blocked",
        chokingRisk: "none",
        evidenceNote: "NHS / AAP: no added salt under 12 months.",
      },
      young_toddler: {
        allowed: "with_preparation",
        preparationRequired: "Minimize added salt. Max ~0.4g sodium/day from all sources.",
        chokingRisk: "none",
        evidenceNote: "NHS: under 24 months, limit sodium significantly; flag high-sodium ingredients.",
      },
      toddler:          { allowed: true, chokingRisk: "none", servingSizeGuidance: "Limit added salt; <1g/day total sodium recommended." },
      preschool:        { allowed: true, chokingRisk: "none" },
      early_school_age: { allowed: true, chokingRisk: "none" },
      growing_child:    { allowed: true, chokingRisk: "none" },
    },
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Look up an entry by foodId. Returns undefined if not found. */
export function getFoodBehavior(foodId: string): FoodBehaviorEntry | undefined {
  return FOOD_BEHAVIOR_REGISTRY.find(f => f.foodId === foodId);
}

/** Get stage behavior for a specific food at a specific stage. */
export function getStageBehavior(
  foodId: string,
  stage: DevelopmentalStage,
): StageBehavior | undefined {
  const entry = getFoodBehavior(foodId);
  return entry?.stages[stage];
}

/**
 * Find all foods that match any of the provided text tokens (name or aliases).
 * Used by the scanner to detect foods mentioned in a recipe.
 */
export function findFoodsByText(text: string): FoodBehaviorEntry[] {
  const lower = text.toLowerCase();
  return FOOD_BEHAVIOR_REGISTRY.filter(entry => {
    if (lower.includes(entry.displayName.toLowerCase())) return true;
    if (entry.aliases?.some(alias => lower.includes(alias.toLowerCase()))) return true;
    return false;
  });
}
