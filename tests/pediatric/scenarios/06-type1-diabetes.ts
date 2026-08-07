/**
 * Scenario Group 06 — Type 1 Diabetes
 * 5 scenarios: carb-consistent protocol, no adult diabetes inheritance
 */

import type { PediatricScenario } from "../types";

export const type1DiabetesScenarios: PediatricScenario[] = [
  // ── S034 ─ T1D — toddler, breakfast ──────────────────────────────────────
  {
    id: "S034",
    description: "Type 1 Diabetes — toddler, consistent-carb breakfast protocol",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s034",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: ["type1_diabetes"],
    },
    request: { foodRequest: "oatmeal with fruit", mealContext: "standard" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016", // limit added sugar
      "MPB-MED003", // T1D carb-consistent protocol
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "t1d-carb-consistent",
      "glycemic-index-awareness",
      "paired-protein-fat",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "GLP-1", "semaglutide", "ozempic", "insulin adjustment",
      "lose weight", "weight loss", "calorie deficit",
    ],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },

  // ── S035 ─ T1D — preschool, lunch ────────────────────────────────────────
  {
    id: "S035",
    description: "Type 1 Diabetes — preschool, consistent-carb lunch",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s035",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["type1_diabetes"],
    },
    request: { foodRequest: "sandwich and fruit", mealContext: "school_lunch" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED003",
      "MPB-CTX001",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "t1d-carb-consistent",
      "glycemic-index-awareness",
      "paired-protein-fat",
      "school-safe-protocol",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "GLP-1", "semaglutide", "metformin", "insulin", "blood sugar management",
      "lose weight", "weight loss",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S036 ─ T1D — early school age, snack ─────────────────────────────────
  {
    id: "S036",
    description: "Type 1 Diabetes — early school age, after-school snack, glycemic balance",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s036",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: ["type1_diabetes"],
    },
    request: { foodRequest: "after school snack" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-MED003",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "t1d-carb-consistent",
      "glycemic-index-awareness",
      "paired-protein-fat",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "GLP-1", "insulin", "blood sugar", "carb ratio", "bolus",
      "lose weight", "diet",
    ],
    expectHardStop: false,
    expectedMealType: "snack",
  },

  // ── S037 ─ T1D — growing child, dinner ───────────────────────────────────
  {
    id: "S037",
    description: "Type 1 Diabetes — growing child, balanced dinner with carb consistency",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s037",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["type1_diabetes"],
    },
    request: { foodRequest: "chicken and rice dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED003",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "t1d-carb-consistent",
      "glycemic-index-awareness",
      "paired-protein-fat",
      "calcium-vitamin-d-support",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "GLP-1", "semaglutide", "metformin", "insulin",
      "lose weight", "weight loss", "calorie restriction",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S038 ─ T1D + peanut allergy — preschool ──────────────────────────────
  {
    id: "S038",
    description: "Type 1 Diabetes + peanut allergy — preschool, dual constraint",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s038",
      ageStage: "preschool",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy" },
      ],
      medicalConditions: ["type1_diabetes"],
    },
    request: { foodRequest: "trail mix snack" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED003",
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil", "groundnut",
    ],
    expectedProtocols: [
      "t1d-carb-consistent",
      "glycemic-index-awareness",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "GLP-1", "insulin", "lose weight", "weight loss",
    ],
    expectHardStop: false,
    expectedMealType: "snack",
  },
];
