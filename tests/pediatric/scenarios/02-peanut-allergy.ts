/**
 * Scenario Group 02 — Peanut Allergy
 * 7 scenarios: one per non-infant stage + EpiPen + suspected reaction
 */

import type { PediatricScenario } from "../types";

export const peanutAllergyScenarios: PediatricScenario[] = [
  // ── S009 ─ Peanut confirmed — beginning foods ─────────────────────────────
  {
    id: "S009",
    description: "Peanut confirmed allergy — beginning foods, hard exclusion in all forms",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s009",
      ageStage: "beginning_foods",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "peanut butter banana purée" },
    expectedRulesFired: [
      "MPB-S001", // no honey
      "MPB-S004", // purée texture
      "MPB-ALLERGY-HARD-STOP", // confirmed allergen hard stop
    ],
    expectedExclusions: ["peanut", "peanut butter", "peanut oil", "groundnut"],
    expectedProtocols: ["confirmed-allergy-exclusion", "allergen-alert-required"],
    mustFlagLanguage: [],
    expectHardStop: false, // allergy is handled, not a full stop
  },

  // ── S010 ─ Peanut confirmed — young toddler ───────────────────────────────
  {
    id: "S010",
    description: "Peanut confirmed allergy — young toddler, satay sauce request",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s010",
      ageStage: "young_toddler",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "chicken with satay sauce" },
    expectedRulesFired: [
      "MPB-S001", // no honey
      "MPB-S005", // no whole nuts
      "MPB-S011", // meat finely chopped
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: ["peanut", "peanut butter", "peanut oil", "groundnut", "satay"],
    expectedProtocols: ["confirmed-allergy-exclusion", "allergen-alert-required"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S011 ─ Peanut confirmed — toddler ────────────────────────────────────
  {
    id: "S011",
    description: "Peanut confirmed allergy — toddler, Thai peanut noodles request",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s011",
      ageStage: "toddler",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "noodles with peanut sauce" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009", // no popcorn
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: ["peanut", "peanut butter", "peanut sauce", "peanut oil", "groundnut"],
    expectedProtocols: ["confirmed-allergy-exclusion", "allergen-alert-required", "safe-alternative-sauce"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S012 ─ Peanut confirmed — preschool ──────────────────────────────────
  {
    id: "S012",
    description: "Peanut confirmed allergy — preschool, school-safe lunch",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s012",
      ageStage: "preschool",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: {
      foodRequest: "lunch box sandwich",
      mealContext: "school_lunch",
      requiresSchoolSafe: true,
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-CTX001", // school-safe context
    ],
    expectedExclusions: ["peanut", "peanut butter", "peanut oil", "groundnut", "mixed nuts"],
    expectedProtocols: ["confirmed-allergy-exclusion", "school-safe-protocol", "allergen-alert-required"],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S013 ─ Peanut confirmed — early school age ───────────────────────────
  {
    id: "S013",
    description: "Peanut confirmed allergy — early school age, Asian stir-fry request",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s013",
      ageStage: "early_school_age",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "stir fry with peanuts" },
    expectedRulesFired: ["MPB-S005", "MPB-ALLERGY-HARD-STOP"],
    expectedExclusions: ["peanut", "peanut oil", "groundnut"],
    expectedProtocols: ["confirmed-allergy-exclusion", "allergen-alert-required"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S014 ─ Peanut confirmed + EpiPen — growing child ─────────────────────
  {
    id: "S014",
    description: "Peanut confirmed + EpiPen prescribed — growing child, severe alert required",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s014",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy", emergencyMedication: true },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "energy bar snack" },
    expectedRulesFired: [
      "MPB-ALLERGY-HARD-STOP",
      "MPB-ALLERGY-EPINEPHRINE", // EpiPen alert rule
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil", "groundnut",
      "may contain peanuts", "processed in peanut facility",
    ],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "epinephrine-preparation-reminder",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S015 ─ Peanut suspected reaction — toddler ───────────────────────────
  {
    id: "S015",
    description: "Peanut suspected reaction — toddler, soft block with note in allergen alerts",
    category: "allergy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s015",
      ageStage: "toddler",
      allergies: [
        { allergenId: "peanut", severity: "suspected_reaction", emergencyMedication: false },
      ],
      medicalConditions: [],
    },
    request: { foodRequest: "veggie dip and crackers" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-ALLERGY-SOFT-BLOCK", // suspected reaction soft block
    ],
    expectedExclusions: ["peanut", "peanut butter", "peanut oil"],
    expectedProtocols: ["suspected-allergen-exclusion", "soft-block-alert-note"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },
];
