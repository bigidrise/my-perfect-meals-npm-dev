/**
 * Pediatric Confidence Scorer
 * Computes the three transparency dimensions for the Parent Education Layer:
 *  - Meal Confidence (profile completeness → how well the AI could personalise)
 *  - Clinical Review Status (which evidence-based protocols are active)
 *  - Personalization Level (which child-specific dimensions shaped this meal)
 * And derives Conflict Resolutions when two active protocols have overlapping rules.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MealConfidence {
  stars: number;               // 1–5
  profileCompleteness: number; // 0–100
  fieldsUsed: string[];
}

export interface ClinicalReviewStatus {
  protocolId: string;
  status: string;  // "Active — Evidence-Based" | "Active — Expert Consensus"
  version: string;
  sources: string[];
}

export interface PersonalizationLevel {
  stars: number;         // 1–5
  dimensionsUsed: string[];
}

export interface ConflictResolution {
  protocol1: string;
  protocol2: string;
  resolution: string;
}

export interface ParentEducationLayer {
  mealConfidence: MealConfidence;
  clinicalReviewStatus: ClinicalReviewStatus[];
  personalizationLevel: PersonalizationLevel;
  conflictResolutions: ConflictResolution[];
}

// ── Internal input types (mirrors what the route knows) ──────────────────────

type DevelopmentalStage =
  | "early_infant" | "beginning_foods" | "young_toddler"
  | "toddler" | "preschool" | "early_school_age" | "growing_child";

type AllergySeverity =
  | "confirmed_allergy" | "suspected_reaction" | "intolerance"
  | "preference_avoid" | "clinician_elimination";

interface AllergyEntry {
  allergenId: string;
  customAllergenName?: string;
  severity: AllergySeverity;
  emergencyMedication?: boolean;
}

interface ParentPrefs {
  dietaryPattern?: string;
  budgetLevel?: string;
  maxCookTimeMinutes?: number;
  requiresSchoolSafe?: boolean;
  requiresPackable?: boolean;
  culturalCuisine?: string;
  goals?: string[];
}

export interface ScorerInput {
  ageStage: DevelopmentalStage;
  allergies: AllergyEntry[];
  parentPrefs: ParentPrefs;
  foodRequest: string;
}

// ── Stage protocol registry ───────────────────────────────────────────────────

const STAGE_PROTOCOLS: Record<DevelopmentalStage, ClinicalReviewStatus> = {
  early_infant: {
    protocolId: "MPB-STAGE-EI",
    status: "Active — Evidence-Based",
    version: "v2.1",
    sources: ["AAP 2022 Infant Feeding Guidelines", "WHO Complementary Feeding 2023"],
  },
  beginning_foods: {
    protocolId: "MPB-STAGE-BF",
    status: "Active — Evidence-Based",
    version: "v2.1",
    sources: ["AAP 2022 Solid Foods Introduction", "ESPGHAN Complementary Feeding 2017"],
  },
  young_toddler: {
    protocolId: "MPB-STAGE-YT",
    status: "Active — Evidence-Based",
    version: "v2.0",
    sources: ["AAP Toddler Nutrition 2023", "USDA DRI 1–3 years"],
  },
  toddler: {
    protocolId: "MPB-STAGE-TO",
    status: "Active — Evidence-Based",
    version: "v2.0",
    sources: ["AAP Toddler Nutrition 2023", "USDA MyPlate for Toddlers"],
  },
  preschool: {
    protocolId: "MPB-STAGE-PS",
    status: "Active — Evidence-Based",
    version: "v2.0",
    sources: ["USDA DRI 4–8 years", "CDC Healthy Eating for Preschoolers 2022"],
  },
  early_school_age: {
    protocolId: "MPB-STAGE-ES",
    status: "Active — Evidence-Based",
    version: "v2.0",
    sources: ["USDA DRI 6–8 years", "AAP Nutrition for School-Age Children 2021"],
  },
  growing_child: {
    protocolId: "MPB-STAGE-GC",
    status: "Active — Evidence-Based",
    version: "v2.0",
    sources: ["USDA DRI 9–13 years", "AAP Pre-Adolescent Nutrition 2021"],
  },
};

// ── Allergen protocol registry ────────────────────────────────────────────────

const ALLERGEN_PROTOCOL_IDS: Record<string, string> = {
  peanut:     "MPB-ALLERGY-PEANUT",
  tree_nuts:  "MPB-ALLERGY-TREENUTS",
  milk:       "MPB-ALLERGY-MILK",
  egg:        "MPB-ALLERGY-EGG",
  wheat:      "MPB-ALLERGY-WHEAT",
  soy:        "MPB-ALLERGY-SOY",
  sesame:     "MPB-ALLERGY-SESAME",
  fish:       "MPB-ALLERGY-FISH",
  shellfish:  "MPB-ALLERGY-SHELLFISH",
  other:      "MPB-ALLERGY-OTHER",
};

const SEVERITY_TO_STATUS: Record<AllergySeverity, string> = {
  confirmed_allergy:    "Active — Hard Stop (confirmed allergen)",
  clinician_elimination:"Active — Hard Stop (clinician-directed elimination)",
  suspected_reaction:   "Active — Soft Block (suspected reaction)",
  intolerance:          "Active — Exclusion (intolerance)",
  preference_avoid:     "Active — Preference Avoidance",
};

// ── Dietary pattern protocol registry ────────────────────────────────────────

const DIETARY_PROTOCOLS: Record<string, ClinicalReviewStatus> = {
  vegan: {
    protocolId: "MPB-DIET-VEGAN",
    status: "Active — Expert Consensus",
    version: "v1.2",
    sources: ["AND Position Paper: Vegetarian/Vegan Diets 2016", "AAP Pediatric Vegan Nutrition 2021"],
  },
  vegetarian: {
    protocolId: "MPB-DIET-VEGETARIAN",
    status: "Active — Expert Consensus",
    version: "v1.2",
    sources: ["AND Position Paper: Vegetarian/Vegan Diets 2016"],
  },
  gluten_free_diagnosed: {
    protocolId: "MPB-DIET-CELIAC",
    status: "Active — Evidence-Based",
    version: "v2.1",
    sources: ["ESPGHAN Celiac Disease Guidelines 2020", "North American Society for Pediatric Gastroenterology 2023"],
  },
  dairy_free: {
    protocolId: "MPB-DIET-DAIRYFREE",
    status: "Active — Expert Consensus",
    version: "v1.0",
    sources: ["AAP Milk Protein Allergy Guidance 2022"],
  },
  kosher: {
    protocolId: "MPB-DIET-KOSHER",
    status: "Active — Dietary Compliance",
    version: "v1.0",
    sources: ["Household dietary practice — no clinical protocol"],
  },
  halal: {
    protocolId: "MPB-DIET-HALAL",
    status: "Active — Dietary Compliance",
    version: "v1.0",
    sources: ["Household dietary practice — no clinical protocol"],
  },
};

// ── Conflict detection ────────────────────────────────────────────────────────

function detectConflicts(input: ScorerInput): ConflictResolution[] {
  const conflicts: ConflictResolution[] = [];
  const { allergies, parentPrefs } = input;

  const hasAllergen = (id: string) =>
    allergies.some(a => a.allergenId === id &&
      (a.severity === "confirmed_allergy" || a.severity === "clinician_elimination"));

  // Wheat allergy + gluten_free_diagnosed → aligned, not a conflict
  // Milk allergy + dairy_free diet → aligned, not a conflict
  // Vegan + egg allergy → aligned (vegan already excludes eggs)
  // Vegan + milk allergy → aligned
  // SchoolSafe + peanut confirmed → aligned (school-safe = nut-free)

  // Actual potential conflicts:
  // Egg allergy + vegetarian (egg is a vegetarian protein staple)
  if (hasAllergen("egg") && parentPrefs.dietaryPattern === "vegetarian") {
    conflicts.push({
      protocol1: "MPB-ALLERGY-EGG",
      protocol2: "MPB-DIET-VEGETARIAN",
      resolution: "Eggs excluded due to confirmed allergy. Vegetarian protein alternatives (legumes, cheese if tolerated, tofu) used instead.",
    });
  }

  // Milk allergy + vegetarian (dairy is a common vegetarian protein)
  if (hasAllergen("milk") && parentPrefs.dietaryPattern === "vegetarian") {
    conflicts.push({
      protocol1: "MPB-ALLERGY-MILK",
      protocol2: "MPB-DIET-VEGETARIAN",
      resolution: "Dairy excluded due to confirmed milk allergy. Plant-based protein sources prioritised.",
    });
  }

  // Soy allergy + vegan (soy is a core vegan protein)
  if (hasAllergen("soy") && parentPrefs.dietaryPattern === "vegan") {
    conflicts.push({
      protocol1: "MPB-ALLERGY-SOY",
      protocol2: "MPB-DIET-VEGAN",
      resolution: "Soy excluded due to confirmed allergy. Alternative vegan proteins (lentils, chickpeas, hemp seeds) prioritised.",
    });
  }

  // Wheat allergy + gluten_free_diagnosed → aligned, add informational entry
  if (hasAllergen("wheat") && parentPrefs.dietaryPattern === "gluten_free_diagnosed") {
    conflicts.push({
      protocol1: "MPB-ALLERGY-WHEAT",
      protocol2: "MPB-DIET-CELIAC",
      resolution: "Both protocols require complete gluten/wheat exclusion — fully aligned. Cross-contact warnings included.",
    });
  }

  return conflicts;
}

// ── Profile completeness scoring ──────────────────────────────────────────────

function computeMealConfidence(input: ScorerInput): MealConfidence {
  const fieldsUsed: string[] = [];
  let score = 0;

  // Stage is always provided (validated at route level) — 30 pts
  score += 30;
  fieldsUsed.push("Developmental stage");

  // Allergies set
  if (input.allergies.length > 0) {
    score += 20;
    fieldsUsed.push("Allergy profile");
  }

  // Dietary pattern
  if (input.parentPrefs.dietaryPattern && input.parentPrefs.dietaryPattern !== "omnivore") {
    score += 15;
    fieldsUsed.push("Dietary pattern");
  }

  // Budget level
  if (input.parentPrefs.budgetLevel) {
    score += 10;
    fieldsUsed.push("Budget preference");
  }

  // Cook time
  if (input.parentPrefs.maxCookTimeMinutes) {
    score += 10;
    fieldsUsed.push("Cook time limit");
  }

  // School-safe / packable flags
  if (input.parentPrefs.requiresSchoolSafe) {
    score += 5;
    fieldsUsed.push("School-safe requirement");
  }
  if (input.parentPrefs.requiresPackable) {
    score += 5;
    fieldsUsed.push("Lunchbox-packable requirement");
  }

  // Goals provided
  if (input.parentPrefs.goals && input.parentPrefs.goals.length > 0) {
    score += 5;
    fieldsUsed.push("Nutrition goals");
  }

  const stars =
    score >= 91 ? 5 :
    score >= 76 ? 4 :
    score >= 61 ? 3 :
    score >= 41 ? 2 : 1;

  return { stars, profileCompleteness: score, fieldsUsed };
}

// ── Personalization level ─────────────────────────────────────────────────────

function computePersonalizationLevel(input: ScorerInput): PersonalizationLevel {
  const dimensionsUsed: string[] = [];

  // Dimension 1: developmental stage
  dimensionsUsed.push("Developmental stage");

  // Dimension 2: allergies/intolerances
  if (input.allergies.length > 0) {
    const labels = input.allergies.map(a => {
      const name = a.allergenId === "other" && a.customAllergenName
        ? a.customAllergenName : a.allergenId;
      return name;
    });
    dimensionsUsed.push(`Allergen exclusions (${labels.join(", ")})`);
  }

  // Dimension 3: dietary pattern
  if (input.parentPrefs.dietaryPattern && input.parentPrefs.dietaryPattern !== "omnivore") {
    dimensionsUsed.push(`Dietary pattern (${input.parentPrefs.dietaryPattern.replace(/_/g, " ")})`);
  }

  // Dimension 4: kitchen / time constraints
  if (input.parentPrefs.maxCookTimeMinutes || input.parentPrefs.budgetLevel) {
    const parts: string[] = [];
    if (input.parentPrefs.maxCookTimeMinutes) parts.push(`${input.parentPrefs.maxCookTimeMinutes}-min cook time`);
    if (input.parentPrefs.budgetLevel) parts.push(input.parentPrefs.budgetLevel.replace(/_/g, " "));
    dimensionsUsed.push(`Kitchen constraints (${parts.join(", ")})`);
  }

  // Dimension 5: school/lunchbox context
  if (input.parentPrefs.requiresSchoolSafe || input.parentPrefs.requiresPackable) {
    const parts: string[] = [];
    if (input.parentPrefs.requiresSchoolSafe) parts.push("school-safe");
    if (input.parentPrefs.requiresPackable) parts.push("lunchbox-packable");
    dimensionsUsed.push(`Serving context (${parts.join(", ")})`);
  }

  // Dimension 6: nutrition goals
  if (input.parentPrefs.goals && input.parentPrefs.goals.length > 0) {
    dimensionsUsed.push("Parent-specified nutrition goals");
  }

  const stars =
    dimensionsUsed.length >= 6 ? 5 :
    dimensionsUsed.length >= 5 ? 5 :
    dimensionsUsed.length >= 4 ? 4 :
    dimensionsUsed.length >= 3 ? 3 :
    dimensionsUsed.length >= 2 ? 2 : 1;

  return { stars, dimensionsUsed };
}

// ── Clinical review status ────────────────────────────────────────────────────

function computeClinicalReviewStatus(input: ScorerInput): ClinicalReviewStatus[] {
  const statuses: ClinicalReviewStatus[] = [];

  // Always: stage protocol
  statuses.push(STAGE_PROTOCOLS[input.ageStage]);

  // Allergy protocols (confirmed or clinician-directed only — hard stops worth surfacing)
  for (const allergy of input.allergies) {
    if (
      allergy.severity === "confirmed_allergy" ||
      allergy.severity === "clinician_elimination" ||
      allergy.severity === "suspected_reaction"
    ) {
      const name = allergy.allergenId === "other" && allergy.customAllergenName
        ? allergy.customAllergenName : allergy.allergenId;
      statuses.push({
        protocolId: ALLERGEN_PROTOCOL_IDS[allergy.allergenId] ?? "MPB-ALLERGY-OTHER",
        status: SEVERITY_TO_STATUS[allergy.severity],
        version: "v2.0",
        sources: [
          "FARE Allergen Management Guidelines 2023",
          allergy.emergencyMedication
            ? "EpiPen/emergency medication on file — strict exclusion enforced"
            : "Standard exclusion protocol applied",
        ],
      });
    }
  }

  // Dietary pattern protocol
  if (input.parentPrefs.dietaryPattern && DIETARY_PROTOCOLS[input.parentPrefs.dietaryPattern]) {
    statuses.push(DIETARY_PROTOCOLS[input.parentPrefs.dietaryPattern]);
  }

  return statuses;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeParentEducationLayer(input: ScorerInput): ParentEducationLayer {
  return {
    mealConfidence: computeMealConfidence(input),
    clinicalReviewStatus: computeClinicalReviewStatus(input),
    personalizationLevel: computePersonalizationLevel(input),
    conflictResolutions: detectConflicts(input),
  };
}
