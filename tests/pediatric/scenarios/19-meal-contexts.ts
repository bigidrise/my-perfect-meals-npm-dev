/**
 * Scenario Group 19 — Meal Contexts
 * 5 scenarios: pantry-only, school lunch (nut-free), birthday party (group scale)
 */

import type { PediatricScenario } from "../types";

export const mealContextScenarios: PediatricScenario[] = [
  // ── S092 ─ Pantry-only mode — toddler ────────────────────────────────────
  {
    id: "S092",
    description: "Pantry-only mode — toddler: resolver uses only listed pantry ingredients",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s092",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: [],
    },
    request: {
      foodRequest: "dinner from what we have",
      mealContext: "pantry_only",
      pantryIngredients: [
        "pasta", "canned tomatoes", "olive oil", "garlic",
        "ground beef", "frozen peas", "parmesan cheese",
      ],
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S011",
      "MPB-S016",
      "MPB-CTX002", // pantry-only context rule
    ],
    expectedExclusions: ["whole nuts", "popcorn"],
    expectedProtocols: [
      "pantry-only-constraint",
      "pantry-ingredient-restriction",
      "toddler-portions",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S093 ─ School lunch — peanut allergy, nut-free rules verified ─────────
  {
    id: "S093",
    description: "School lunch — peanut allergy + requiresSchoolSafe: nut-free rules enforced",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s093",
      ageStage: "preschool",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: {
      foodRequest: "lunchbox",
      mealContext: "school_lunch",
      requiresSchoolSafe: true,
      requiresPackable: true,
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-CTX001", // school-safe context
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil", "groundnut",
      "tree nuts", "almond", "cashew", "walnut",
      "mixed nuts",
    ],
    expectedProtocols: [
      "school-safe-protocol",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "packable-lunch",
      "nut-free-school-zone",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S094 ─ School lunch — multiple allergies, nut-free ───────────────────
  {
    id: "S094",
    description: "School lunch — peanut + tree nut + sesame confirmed: full nut-free + extra allergens",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s094",
      ageStage: "early_school_age",
      allergies: [
        { allergenId: "peanut",    severity: "confirmed_allergy" },
        { allergenId: "tree_nuts", severity: "confirmed_allergy" },
        { allergenId: "sesame",    severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: {
      foodRequest: "school lunchbox",
      mealContext: "school_lunch",
      requiresSchoolSafe: true,
      requiresPackable: true,
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-ALLERGY-COMPOUND-REVIEW",
      "MPB-CTX001",
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil", "groundnut",
      "tree nuts", "almond", "cashew", "walnut", "pecan", "pistachio",
      "sesame", "tahini", "sesame oil", "sesame seed",
    ],
    expectedProtocols: [
      "school-safe-protocol",
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "packable-lunch",
      "nut-free-school-zone",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S095 ─ Birthday party — group scale, preschool ────────────────────────
  {
    id: "S095",
    description: "Birthday party — preschool group: scaled servings, celebratory but nutritious",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s095",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: [],
    },
    request: {
      foodRequest: "birthday cake",
      mealContext: "birthday_party",
      servings: 15,
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-CTX003", // group/party scale
    ],
    expectedExclusions: ["whole nuts", "hard candy", "popcorn"],
    expectedProtocols: [
      "party-group-scale",
      "preschool-portions",
      "allergen-alert-required",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S096 ─ Birthday party — allergen-safe for group ──────────────────────
  {
    id: "S096",
    description: "Birthday party — mixed-allergen group: safest common denominator",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s096",
      ageStage: "early_school_age",
      allergies: [
        { allergenId: "peanut",    severity: "confirmed_allergy" },
        { allergenId: "tree_nuts", severity: "confirmed_allergy" },
        { allergenId: "milk",      severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: {
      foodRequest: "birthday cupcakes safe for the whole class",
      mealContext: "birthday_party",
      requiresSchoolSafe: true,
      servings: 25,
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-ALLERGY-COMPOUND-REVIEW",
      "MPB-CTX001",
      "MPB-CTX003",
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil",
      "tree nuts", "almond", "cashew", "walnut",
      "milk", "dairy", "butter", "cream", "cheese",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "school-safe-protocol",
      "party-group-scale",
      "nut-free-school-zone",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },
];
