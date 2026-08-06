/**
 * Scenario Group 07 — Type 2 Diabetes
 * 5 scenarios: glycemic management, no weight-loss language verified
 */

import type { PediatricScenario } from "../types";

export const type2DiabetesScenarios: PediatricScenario[] = [
  // ── S039 ─ T2D — growing child, breakfast ─────────────────────────────────
  {
    id: "S039",
    description: "Type 2 Diabetes — growing child, breakfast without weight-loss framing",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s039",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["type2_diabetes"],
    },
    request: { foodRequest: "breakfast bowl" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED004", // T2D glycemic management
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "t2d-glycemic-management",
      "low-glycemic-index-focus",
      "fiber-rich-foods",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit", "diet",
      "obesity", "overweight", "fat", "slim down",
      "GLP-1", "semaglutide", "metformin",
    ],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },

  // ── S040 ─ T2D — growing child, lunch, no weight-loss language ────────────
  {
    id: "S040",
    description: "Type 2 Diabetes — growing child, lunch: wellness framing enforced, no diet language",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s040",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["type2_diabetes"],
    },
    request: { foodRequest: "lunch meal" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED004",
      "MPB-LANGUAGE-WELLNESS", // wellness framing rule
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "t2d-glycemic-management",
      "low-glycemic-index-focus",
      "fiber-rich-foods",
      "wellness-positive-framing",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit", "diet",
      "overweight", "obese", "obesity", "fat",
      "GLP-1", "semaglutide", "metformin", "insulin resistance",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S041 ─ T2D + celiac — growing child ───────────────────────────────────
  {
    id: "S041",
    description: "Type 2 Diabetes + celiac — growing child, dual protocol intersection",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s041",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "wheat", severity: "clinician_elimination" },
      ],
      medicalConditions: ["type2_diabetes", "celiac_disease"],
    },
    request: { foodRequest: "pasta dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-MED004",
      "MPB-MED014",
      "MPB-ALLERGY-HARD-STOP",
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye",
    ],
    expectedProtocols: [
      "t2d-glycemic-management",
      "celiac-strict-gluten-free",
      "low-glycemic-index-focus",
      "allergen-alert-required",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit",
      "overweight", "obese", "GLP-1", "metformin",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S042 ─ T2D + iron deficiency — growing child ──────────────────────────
  {
    id: "S042",
    description: "Type 2 Diabetes + iron deficiency — growing child, iron-rich low-GI focus",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s042",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["type2_diabetes", "iron_deficiency_anemia"],
    },
    request: { foodRequest: "dinner meal" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-MED004",
      "MPB-MED005", // iron deficiency protocol
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "t2d-glycemic-management",
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "low-glycemic-index-focus",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit",
      "overweight", "obese", "GLP-1",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S043 ─ T2D — early school age ────────────────────────────────────────
  {
    id: "S043",
    description: "Type 2 Diabetes — early school age, no adult diabetes language",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s043",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: ["type2_diabetes"],
    },
    request: { foodRequest: "afternoon snack" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-MED004",
      "MPB-LANGUAGE-WELLNESS",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "t2d-glycemic-management",
      "low-glycemic-index-focus",
      "fiber-rich-foods",
      "wellness-positive-framing",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit", "diet",
      "overweight", "obese", "obesity", "fat", "slim",
      "GLP-1", "semaglutide", "metformin", "insulin", "A1C",
    ],
    expectHardStop: false,
    expectedMealType: "snack",
  },
];
