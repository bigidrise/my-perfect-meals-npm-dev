/**
 * Scenario Group 10 — Pediatric Obesity
 * 5 scenarios: wellness framing enforced, no weight-loss language, no body labeling
 */

import type { PediatricScenario } from "../types";

export const pediatricObesityScenarios: PediatricScenario[] = [
  // ── S052 ─ Pediatric obesity — preschool ──────────────────────────────────
  {
    id: "S052",
    description: "Pediatric obesity — preschool: wellness framing, zero weight-loss language",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s052",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["pediatric_obesity"],
    },
    request: { foodRequest: "healthy after-school snack" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED007",           // pediatric obesity protocol
      "MPB-LANGUAGE-WELLNESS",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "pediatric-obesity-wellness-framing",
      "balanced-nutrient-density",
      "no-restriction-language",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit", "diet",
      "overweight", "obese", "obesity", "fat", "slim down",
      "cut calories", "portion restriction", "low-calorie",
    ],
    expectHardStop: false,
    expectedMealType: "snack",
  },

  // ── S053 ─ Pediatric obesity — early school age ───────────────────────────
  {
    id: "S053",
    description: "Pediatric obesity — early school age: no diet language, nourishing framing",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s053",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: ["pediatric_obesity"],
    },
    request: { foodRequest: "lunch meal" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED007",
      "MPB-LANGUAGE-WELLNESS",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "pediatric-obesity-wellness-framing",
      "balanced-nutrient-density",
      "no-restriction-language",
      "fiber-rich-foods",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit", "diet",
      "overweight", "obese", "obesity", "fat", "chubby",
      "slim", "trim", "cut back", "low-calorie", "light",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S054 ─ Pediatric obesity — growing child, no body label ───────────────
  {
    id: "S054",
    description: "Pediatric obesity — growing child: body labels banned from context output",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s054",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["pediatric_obesity"],
    },
    request: { foodRequest: "dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED007",
      "MPB-LANGUAGE-WELLNESS",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "pediatric-obesity-wellness-framing",
      "balanced-nutrient-density",
      "no-restriction-language",
      "fiber-rich-foods",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "overweight", "obese", "obesity", "fat", "chubby", "heavy",
      "ectomorph", "endomorph", "mesomorph",
      "lose weight", "weight loss", "calorie deficit", "diet",
      "GLP-1", "semaglutide",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S055 ─ Pediatric obesity + T2D — growing child ────────────────────────
  {
    id: "S055",
    description: "Pediatric obesity + T2D — growing child: dual wellness + glycemic framing",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s055",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["pediatric_obesity", "type2_diabetes"],
    },
    request: { foodRequest: "after school snack" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED004",
      "MPB-MED007",
      "MPB-LANGUAGE-WELLNESS",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "pediatric-obesity-wellness-framing",
      "t2d-glycemic-management",
      "low-glycemic-index-focus",
      "no-restriction-language",
      "fiber-rich-foods",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit", "diet",
      "overweight", "obese", "obesity", "fat",
      "GLP-1", "semaglutide", "metformin",
    ],
    expectHardStop: false,
    expectedMealType: "snack",
  },

  // ── S056 ─ Pediatric obesity — toddler ───────────────────────────────────
  {
    id: "S056",
    description: "Pediatric obesity — toddler: no restrictive language at any age",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s056",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: ["pediatric_obesity"],
    },
    request: { foodRequest: "dinner meal" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED007",
      "MPB-LANGUAGE-WELLNESS",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "pediatric-obesity-wellness-framing",
      "balanced-nutrient-density",
      "no-restriction-language",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "diet", "overweight",
      "obese", "obesity", "fat", "chubby", "light",
      "low-calorie", "cut back",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
