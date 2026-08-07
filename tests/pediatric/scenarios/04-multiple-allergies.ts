/**
 * Scenario Group 04 — Multiple Simultaneous Allergies
 * 8 scenarios covering common multi-allergen combinations
 */

import type { PediatricScenario } from "../types";

export const multipleAllergyScenarios: PediatricScenario[] = [
  // ── S021 ─ Peanut + tree nuts + milk — toddler ───────────────────────────
  {
    id: "S021",
    description: "Peanut + tree nuts + milk confirmed — toddler, macaroni and cheese requested",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s021",
      ageStage: "toddler",
      allergies: [
        { allergenId: "peanut",     severity: "confirmed_allergy" },
        { allergenId: "tree_nuts",  severity: "confirmed_allergy" },
        { allergenId: "milk",       severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "mac and cheese" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "tree nuts", "almond", "cashew", "walnut",
      "milk", "cheese", "butter", "cream", "lactose", "dairy",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "dairy-free-alternative",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S022 ─ Peanut + egg + wheat — preschool ───────────────────────────────
  {
    id: "S022",
    description: "Peanut + egg + wheat confirmed — preschool, pancakes requested",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s022",
      ageStage: "preschool",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy" },
        { allergenId: "egg",    severity: "confirmed_allergy" },
        { allergenId: "wheat",  severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "pancakes" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "peanut", "peanut butter",
      "egg", "egg white", "egg yolk",
      "wheat", "flour", "gluten", "bread",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "gluten-free-egg-free-alternative",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },

  // ── S023 ─ Milk + soy — beginning foods ───────────────────────────────────
  {
    id: "S023",
    description: "Milk + soy confirmed — beginning foods, critical for formula safety note",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s023",
      ageStage: "beginning_foods",
      allergies: [
        { allergenId: "milk", severity: "confirmed_allergy" },
        { allergenId: "soy",  severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "veggie purée with added protein" },
    expectedRulesFired: [
      "MPB-S001", // no honey
      "MPB-S002", // no cow's milk as main drink
      "MPB-S004", // purée texture
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "milk", "dairy", "butter", "cheese", "cream", "lactose",
      "soy", "soy milk", "tofu", "edamame", "soybean",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "beginning-foods-texture",
    ],
    mustFlagLanguage: ["homemade formula", "formula substitution"],
    expectHardStop: false,
  },

  // ── S024 ─ Peanut + shellfish — growing child ─────────────────────────────
  {
    id: "S024",
    description: "Peanut + shellfish confirmed — growing child, both EpiPen prescribed",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s024",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "peanut",    severity: "confirmed_allergy", emergencyMedication: true },
        { allergenId: "shellfish", severity: "confirmed_allergy", emergencyMedication: true },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "surf and turf style dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-ALLERGY-EPINEPHRINE",
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil", "groundnut",
      "shrimp", "crab", "lobster", "clam", "oyster", "scallop", "mussel",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "epinephrine-preparation-reminder",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S025 ─ Top 8 allergens — early school age ─────────────────────────────
  {
    id: "S025",
    description: "All top-8 allergens confirmed — early school age, maximum exclusion verification",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s025",
      ageStage: "early_school_age",
      allergies: [
        { allergenId: "peanut",    severity: "confirmed_allergy" },
        { allergenId: "tree_nuts", severity: "confirmed_allergy" },
        { allergenId: "milk",      severity: "confirmed_allergy" },
        { allergenId: "egg",       severity: "confirmed_allergy" },
        { allergenId: "wheat",     severity: "confirmed_allergy" },
        { allergenId: "soy",       severity: "confirmed_allergy" },
        { allergenId: "fish",      severity: "confirmed_allergy" },
        { allergenId: "shellfish", severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "pasta dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-ALLERGY-COMPOUND-REVIEW",
    ],
    expectedExclusions: [
      "peanut", "tree nuts", "milk", "dairy", "egg", "wheat", "gluten",
      "soy", "fish", "shellfish",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "top8-maximum-exclusion",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S026 ─ Peanut + tree nuts + sesame — young toddler ───────────────────
  {
    id: "S026",
    description: "Peanut + tree nuts + sesame confirmed — young toddler, hummus requested",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s026",
      ageStage: "young_toddler",
      allergies: [
        { allergenId: "peanut",    severity: "confirmed_allergy" },
        { allergenId: "tree_nuts", severity: "confirmed_allergy" },
        { allergenId: "sesame",    severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "hummus with veggie dippers" },
    expectedRulesFired: [
      "MPB-S001",
      "MPB-S005",
      "MPB-S008",
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "peanut", "tree nuts", "tahini", "sesame", "sesame oil", "sesame seed",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S027 ─ Egg + milk — toddler ──────────────────────────────────────────
  {
    id: "S027",
    description: "Egg + milk confirmed — toddler, scrambled eggs and cheese breakfast",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s027",
      ageStage: "toddler",
      allergies: [
        { allergenId: "egg",  severity: "confirmed_allergy" },
        { allergenId: "milk", severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "scrambled eggs and cheese" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "egg", "egg white", "egg yolk",
      "milk", "cheese", "butter", "cream", "dairy",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "egg-free-dairy-free-alternative",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },

  // ── S028 ─ Fish + shellfish — growing child ───────────────────────────────
  {
    id: "S028",
    description: "Fish + shellfish confirmed — growing child, seafood paella requested",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s028",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "fish",      severity: "confirmed_allergy" },
        { allergenId: "shellfish", severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "seafood paella" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "fish", "salmon", "tuna", "cod", "tilapia", "halibut",
      "shellfish", "shrimp", "crab", "lobster", "clam", "scallop",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
