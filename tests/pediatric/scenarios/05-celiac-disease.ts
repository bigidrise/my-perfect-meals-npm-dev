/**
 * Scenario Group 05 — Celiac Disease + Allergy Combinations
 * 5 scenarios
 */

import type { PediatricScenario } from "../types";

export const celiacDiseaseScenarios: PediatricScenario[] = [
  // ── S029 ─ Celiac + peanut allergy — toddler ─────────────────────────────
  {
    id: "S029",
    description: "Celiac + peanut confirmed — toddler, pasta dinner requested",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s029",
      ageStage: "toddler",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy" },
        { allergenId: "wheat",  severity: "clinician_elimination" },
      ],
      medicalConditions: ["celiac_disease"],
    },
    request: { foodRequest: "pasta dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED014", // celiac strict gluten-free protocol
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye", "semolina", "durum",
      "peanut", "peanut butter", "peanut oil",
    ],
    expectedProtocols: [
      "celiac-strict-gluten-free",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "gluten-free-grain-alternatives",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S030 ─ Celiac + egg allergy — preschool ───────────────────────────────
  {
    id: "S030",
    description: "Celiac + egg confirmed — preschool, pancakes are doubly constrained",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s030",
      ageStage: "preschool",
      allergies: [
        { allergenId: "egg",   severity: "confirmed_allergy" },
        { allergenId: "wheat", severity: "clinician_elimination" },
      ],
      medicalConditions: ["celiac_disease"],
    },
    request: { foodRequest: "pancakes for breakfast" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED014",
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye", "semolina",
      "egg", "egg white", "egg yolk",
    ],
    expectedProtocols: [
      "celiac-strict-gluten-free",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "gluten-free-egg-free-alternative",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },

  // ── S031 ─ Celiac + milk allergy — early school age ──────────────────────
  {
    id: "S031",
    description: "Celiac + milk confirmed — early school age, pizza requested",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s031",
      ageStage: "early_school_age",
      allergies: [
        { allergenId: "milk",  severity: "confirmed_allergy" },
        { allergenId: "wheat", severity: "clinician_elimination" },
      ],
      medicalConditions: ["celiac_disease"],
    },
    request: { foodRequest: "pizza" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED014",
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye",
      "milk", "cheese", "butter", "cream", "dairy",
    ],
    expectedProtocols: [
      "celiac-strict-gluten-free",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "dairy-free-alternative",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S032 ─ Celiac alone — growing child ───────────────────────────────────
  {
    id: "S032",
    description: "Celiac disease alone — growing child, strict gluten-free protocol",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s032",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "wheat", severity: "clinician_elimination" },
      ],
      medicalConditions: ["celiac_disease"],
    },
    request: { foodRequest: "chicken stir fry" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-MED014",
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye", "soy sauce", "teriyaki sauce",
    ],
    expectedProtocols: [
      "celiac-strict-gluten-free",
      "allergen-alert-required",
      "cross-contamination-warning",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S033 ─ Celiac + multiple allergies — preschool ────────────────────────
  {
    id: "S033",
    description: "Celiac + peanut + egg + milk confirmed — preschool, maximum dietary restriction",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s033",
      ageStage: "preschool",
      allergies: [
        { allergenId: "wheat",  severity: "clinician_elimination" },
        { allergenId: "peanut", severity: "confirmed_allergy" },
        { allergenId: "egg",    severity: "confirmed_allergy" },
        { allergenId: "milk",   severity: "confirmed_allergy" },
      ],
      medicalConditions: ["celiac_disease"],
    },
    request: { foodRequest: "birthday cupcake" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-ALLERGY-COMPOUND-REVIEW",
      "MPB-MED014",
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye",
      "peanut", "peanut butter",
      "egg", "egg white", "egg yolk",
      "milk", "cheese", "butter", "cream", "dairy",
    ],
    expectedProtocols: [
      "celiac-strict-gluten-free",
      "confirmed-allergy-exclusion",
      "multi-allergen-compound-check",
      "allergen-alert-required",
      "top8-maximum-exclusion",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },
];
