/**
 * Scenario Group 03 — Tree Nut Allergy
 * 5 scenarios covering confirmed, intolerance, and preference_avoid severities
 */

import type { PediatricScenario } from "../types";

export const treeNutAllergyScenarios: PediatricScenario[] = [
  // ── S016 ─ Tree nut confirmed — toddler ──────────────────────────────────
  {
    id: "S016",
    description: "Tree nut confirmed allergy — toddler, walnut brownie request",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s016",
      ageStage: "toddler",
      allergies: [
        { allergenId: "tree_nuts", severity: "confirmed_allergy", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "brownie with walnuts" },
    expectedRulesFired: [
      "MPB-S005", // no whole nuts / large nut pieces
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "walnut", "almond", "cashew", "pecan", "pistachio",
      "macadamia", "brazil nut", "hazelnut", "pine nut", "tree nuts",
    ],
    expectedProtocols: ["confirmed-allergy-exclusion", "allergen-alert-required"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S017 ─ Tree nut confirmed — preschool, pesto pasta request ────────────
  {
    id: "S017",
    description: "Tree nut confirmed allergy — preschool, pesto contains pine nuts",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s017",
      ageStage: "preschool",
      allergies: [
        { allergenId: "tree_nuts", severity: "confirmed_allergy", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "pesto pasta" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "pine nut", "pesto", "almond", "cashew", "walnut", "tree nuts",
    ],
    expectedProtocols: ["confirmed-allergy-exclusion", "allergen-alert-required", "safe-alternative-sauce"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S018 ─ Tree nut confirmed — early school age, trail mix request ───────
  {
    id: "S018",
    description: "Tree nut confirmed allergy — early school age, trail mix request excluded",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s018",
      ageStage: "early_school_age",
      allergies: [
        { allergenId: "tree_nuts", severity: "confirmed_allergy", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "trail mix snack" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010", // no hard candy
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "almond", "cashew", "walnut", "pecan", "pistachio",
      "macadamia", "brazil nut", "hazelnut", "pine nut", "mixed nuts",
    ],
    expectedProtocols: ["confirmed-allergy-exclusion", "allergen-alert-required"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S019 ─ Tree nut intolerance — growing child ───────────────────────────
  {
    id: "S019",
    description: "Tree nut intolerance — growing child, excluded but no hard-stop language",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s019",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "tree_nuts", severity: "intolerance", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "granola breakfast bowl" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-ALLERGY-INTOLERANCE", // intolerance exclusion (softer than hard-stop)
    ],
    expectedExclusions: [
      "almond", "cashew", "walnut", "pecan", "pistachio",
      "macadamia", "brazil nut", "hazelnut", "pine nut",
    ],
    expectedProtocols: ["intolerance-exclusion", "allergen-alert-required"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S020 ─ Tree nut preference_avoid — preschool ─────────────────────────
  {
    id: "S020",
    description: "Tree nut preference_avoid — preschool, parent prefers to avoid",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s020",
      ageStage: "preschool",
      allergies: [
        { allergenId: "tree_nuts", severity: "preference_avoid", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "cookie snack" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-ALLERGY-PREFERENCE", // preference avoid
    ],
    expectedExclusions: ["tree nuts", "almond", "cashew", "walnut"],
    expectedProtocols: ["preference-exclusion"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },
];
